import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV}`, debug: false });
export const TG_TOKEN = process.env.TG_SCRAPPER_TOKEN
export const API_URL = process.env.API_URL
export const TELEGRAM_API = `https://api.telegram.org/bot${TG_TOKEN}`
export const DB_URI = process.env.DB_URI
export const SSConfig = {
    main: {
        link: 'https://www.ss.lv',
        selectors: {
            title: '.headtitle',
            filter: {
                list: '#filter_tbl .filter_name',
            }
        }
    },
    mobile: {
        link: 'https://m.ss.lv',
        selectors: {
            title: '.title_head',
            filter: {
                hash: '#search',
                list: '#m_filter_dv .filter_name',
            }
        }
    }
    /* "mainLink": "https://www.ss.lv",
    mobileLink: 'https://m.ss.lv',
    "categories": {
        "selector": "#page_main_full",
        "href": ".a",
        "subcategories": ".main_category a"
    } */
}
export const SEARCH_DELAY = 1000 * 60 * 5 // every 5m
// export const SEARCH_DELAY = 1000 * 60 * 60 * .5 // every 30m

/* TODO:
    1. Сгенерировать фильтр в зависимости от того, мобильная или лаптоп ссылка.
    2. Все ID сохранять как select/input name.
    3. Если ссылка на мобильный, то в конце в фильтре добавлять hash - #search
    4. 
*/