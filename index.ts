import axios from "axios";
import cheerio from "cheerio";
import * as fs from "fs";
import puppeteer from 'puppeteer';

async function writepage(filecode: string, url: string): Promise<string[]> {
    try {
        const AxiosInstance = axios.create();
        const response = await AxiosInstance.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        $('style').remove();
        $('script').remove();

        // TEXT CONTENT 
        const textArray: string[] = [];
        $('body').find('*').each((index, element) => {
            const $element = $(element);
            const text = $element.text().trim();
            let isHidden = false;

            // Check for unwanted classes
            const unwantedClasses = ['advertisement', 'hidden', 'tracking-element', 'no-display', '.wp-smiley', '.wp-block-button__link', '.wp-block-file__button'];
            if (unwantedClasses.some(className => $element.hasClass(className))) {
                isHidden = true;
            }

            // Check for unwanted tags
            const unwantedTags = ['img', 'style', 'link', 'iframe', 'script', 'div', 'template', 'noscript', "span", 'meta'];
            if (unwantedTags.includes($element.prop('tagName').toLowerCase())) {
                isHidden = true;
            }

            // Check for unwanted words 
            const unwantedWords = ['<img']
            if (unwantedWords.some(word => text.includes(word))) {
                isHidden = true;
            }

            // Add to text array 
            if (!isHidden) {
                textArray.push(text);
            }
        });
        return textArray;
        // TEXT TO STRING
        /*
        let resultString: string = '';
        textArray.forEach(item => {
            let clean_item = item;
            clean_item = clean_item.replace(/[ \t]+/g, ' ').trim();
            clean_item = clean_item.replace(/[\n\r\s]+/g, ' ').trim();
            if (!resultString.includes(clean_item)) {
                resultString += clean_item + ' \n';
            }
        });
        return resultString;
        */
    } catch (error) {
        return [];
    }
}
async function static_crawl(baseUrl: string): Promise<string[]> {
    const AxiosInstance = axios.create();
    const uniqueLinks = [];

    try {
        const response = await AxiosInstance.get(baseUrl);
        const html = response.data;
        const $ = cheerio.load(html);
        const links = new Set();

        $('a').each((index, element) => {
            const href = $(element).attr('href');
            if (href) {
                const url = new URL(href, baseUrl);
                // Check if the domain matches
                if (url.hostname === new URL(baseUrl).hostname) {
                    const parts: string[] = url.href.split(/[?#]/);
                    if (keepUrl(parts[0])) {
                        links.add(parts[0]);
                    }
                }
            }
        });
        uniqueLinks.push(...Array.from(links));
        return uniqueLinks;
    } catch (error) {
        return uniqueLinks; // Return an empty array in case of an error
    }
}
async function scrapeSite(firmcode: string, baseUrl: string, depth_limit: number = 2, pagelimit: number = 20, timeout: number = 1000): Promise<void> {
    let currentQueue: string[] = [baseUrl];
    let nextQueue: string[] = [];
    let visited: string[] = [];
    let depths = [];
    let depth = 0
    while (depth < depth_limit) {
        if (currentQueue.length > 0) {
            if (depth < depth_limit - 1) {
                const retrieved = await static_crawl(currentQueue[0]);
                for (const r of retrieved) {
                    if (!visited.includes(r) && !currentQueue.includes(r) && !nextQueue.includes(r)) {
                        nextQueue.push(r);
                    }
                }
            }
            visited.push(currentQueue.shift()!);
            depths.push(depth)
        } else {
            depth++;
            currentQueue = nextQueue;
            nextQueue = [];
        }
    }
    // if there are too many pages the code will be slow. pagelimit limits how many pages you scrape. 
    visited.sort((a, b) => a.length - b.length);
    visited = visited.slice(0, pagelimit);

    let resultString = ""
    for (let i = 0; i < visited.length; i++) {
        const url = visited[i]
        const filecode = firmcode + '-' + depths[i] + '-' + i
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve([]);
            }, timeout);
        });
        const textArrayPromise = writepage(filecode, url);
        const result = await Promise.race([textArrayPromise, timeoutPromise]);
        const textArray = (result === timeoutPromise ? [] : result) as string[];
        textArray.forEach(item => {
            let clean_item = item;
            clean_item = clean_item.replace(/[ \t]+/g, ' ').trim();
            clean_item = clean_item.replace(/[\n\r\s]+/g, ' ').trim();
            if (!resultString.includes(clean_item)) {
                resultString += clean_item + ' \n';
            }
        });
    }
    // write all pages into one file. Do we want all in one file? Or do we weight files by distance from home page? 
    fs.writeFileSync('output/' + firmcode + '.txt', resultString);

    // unique words array 
    const wordsArray: string[] = resultString.toLowerCase().split(/\W+/);
    const wordsSet: Set<string> = new Set(wordsArray);
    const uniqueWordsArray: string[] = Array.from(new Set(wordsArray));
    const uniqueWordsString: string = visited.join('\n') + '\n'+ uniqueWordsArray.join(' ');
    fs.writeFileSync('unique/' + firmcode + '.txt', uniqueWordsString);

    // 1000 most common words 
    const topWords = getMostCommonWords(wordsArray);
    const topWordsString: string = visited.join('\n')+'\n'+topWords.join(' ');
    fs.writeFileSync('top_1000/' + firmcode + '.txt', topWordsString);

    // console output
    console.log(visited)
    console.log("I just scraped " + visited.length + " pages off of " + baseUrl)
}
function keepUrl(url: string): boolean {
    const languageCodes = ["aa", "ab", "af", "ak", "am", "an", "ar", "as", "av", "ay", "az", "ba", "be", "bg", "bh", "bi", "bm", "bn", "bo", "br", "bs", "ca", "ce", "ch", "co", "cr", "cs", "cu", "cv", "cy", "da", "de", "dv", "dz", "ee", "el", "eo", "es", "et", "eu", "fa", "ff", "fi", "fj", "fo", "fr", "fy", "ga", "gd", "gl", "gn", "gu", "gv", "ha", "he", "hi", "ho", "hr", "ht", "hu", "hy", "hz", "ia", "id", "ie", "ig", "ii", "ik", "io", "is", "it", "iu", "ja", "jv", "ka", "kg", "ki", "kj", "kk", "kl", "km", "kn", "ko", "kr", "ks", "ku", "kv", "kw", "ky", "la", "lb", "lg", "li", "ln", "lo", "lt", "lu", "lv", "mg", "mh", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "na", "nb", "nd", "ne", "ng", "nl", "nn", "no", "nr", "nv", "ny", "oc", "oj", "om", "or", "os", "pa", "pi", "pl", "ps", "pt", "qu", "rm", "rn", "ro", "ru", "rw", "sa", "sc", "sd", "se", "sg", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw", "ta", "te", "tg", "th", "ti", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty", "ug", "uk", "ur", "uz", "ve", "vi", "vo", "wa", "wo", "xh", "yi", "yo", "za", "zh", "zu", "zh-hans", "zh-hant", "en-US", "en-GB", "pt-BR", "pt-PT", "es-ES", "es-MX", "fr-CA", "fr-FR", "de-DE", "de-CH", "zh-Hans", "zh-Hant", "sr-Cyrl", "sr-Latn", "zh-Hans-CN", "zh-Hant-TW", "az-Cyrl-AZ", "uz-Latn-UZ"];
    const segments = url.split('/');
    const unwantedWords = ["@", "/privacy", "/terms"];
    if (unwantedWords.some(word => url.includes(word))) {
        return false;
    }
    else if (segments.some(segment => languageCodes.includes(segment))) {
        return false;
    };
    return true;
}
function getMostCommonWords(words: string[], topCount: number = 1000): string[] {
    const wordCounts = new Map<string, number>();

    words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    return Array.from(wordCounts.entries())
                .sort((a, b) => b[1] - a[1]) // Sort by frequency
                .slice(0, topCount) // Get top 'topCount' words
                .map(entry => entry[0]); // Extract the word
}
const firmCode = "gardhouse"
const baseUrl = "https://gardhouse.org/"

scrapeSite(firmCode, baseUrl)
