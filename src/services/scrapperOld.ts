/* import { Request, Response } from "express"
import { getCookie, sendMediaGroup, sendMessage } from "../middleware/scrapper"
import { client } from '../middleware/scrapper/axios-client'
import { JSDOM } from 'jsdom'
import { TGSendMessage } from "../middleware/scrapper/tg"
import { ScrapperAdModel, ScrapperAdSchema, ScrapperUserSchema } from "../models"
import { SEARCH_DELAY } from "../config/scrapper"
import { Types } from "mongoose"
type ResponseMessage = {
    from: {
        is_bot: boolean,
        id: number,
        first_name: string,
        username: string
    },
    date: number,
    text: string
}

const CONVERSATIONS = {}
export async function initScrapper(req: Request, res: Response) {
    try {
        const { from, date, text }: ResponseMessage = req.body.message,
            { is_bot, id, first_name, username } = from
        if (is_bot || !text) return false
        if (!CONVERSATIONS[id]) {
            CONVERSATIONS[id] = {}
        }
        const activeLink = Object.keys(CONVERSATIONS[id]).find(e => CONVERSATIONS[id][e].inProgress)
        // console.log('isbot', is_bot, 'firstname', first_name, 'username', username, 'text', text)
        if (text === '/start') {
        } else if (text.startsWith('/link')) {
            const link = normalizeSsLink(text.split('/link ')?.[1] || '')
            if (!link) {
                return await TGSendMessage(id, `Nav pareizs links!`)
            }
            const { title, filter } = await getAdFilter(link)
            CONVERSATIONS[id] = {
                ...CONVERSATIONS[id],
                username,
                [link]: { title, link, filter, myFilter: [], step: 0, inProgress: true, isActive: false }
            }
            const filterText = generateFilterText(filter[0])
            await TGSendMessage(id, `Filtrs: \n${filterText}`)
        } else if (text === '/skip') {
            if (!activeLink) {
                return await TGSendMessage(id, `Jums nav aktivs filtrs`)
            }
            CONVERSATIONS[id][activeLink].myFilter[CONVERSATIONS[id][activeLink].step] = ''
            const filterText = addNextFilter(id)
            if (filterText) {
                await TGSendMessage(id, filterText)
            } else {
                await saveFilter(id, CONVERSATIONS[id][activeLink])
                await TGSendMessage(id, `Jūsu sludinājums veksmīgi saglabāts 🥳`)
                CONVERSATIONS[id][activeLink].inProgress = false
                CONVERSATIONS[id][activeLink].isActive = true
            }
        } else if (text === '/list') {
            const user = await ScrapperUserSchema.findOne({ tgId: id }, { adSubscribes: true })
            if (!user) return await TGSendMessage(id, 'Jums nav sludinājumi!')
            const ads = await ScrapperAdSchema.find({ _id: user.adSubscribes.filter(e => e) })
            const options = ads
                .map((e, i) => `${i + 1}. ${e.title}\n${e.link}\n${e.myFilter.length ? `<i>Filtrs</i>:\n${getFilterTextByMyFilter(e)}` : 'Nav filtrs'}`)
                .join('\n\n')
            await TGSendMessage(id, `Jusu sludinājumi:\n${options}`)
        } else if (text.startsWith('/delete')) {
            const index = +text.substring(8)
            if (!index) return await TGSendMessage(id, 'Ievadi sludinājuma nurumu, kuru vēlies izdzēst!')
            await ScrapperUserSchema.updateOne({ tgId: id }, {
                $unset: { [`adSubscribes.${index - 1}`]: 1 },
            })
            await TGSendMessage(id, `Sludinājums ir veiksmīgi izdzēst`)
        } else {
            if (!activeLink) {
                return await TGSendMessage(id, `Nav aktivs filtrs`)
            }
            console.log('Сверяю, правильно ли выбрано и даю еще фильтр')
            //TODO: Проверить, в диапазоне фильтра ли
            let value = ''
            const currentFilter = CONVERSATIONS[id][activeLink].filter[CONVERSATIONS[id][activeLink].step]
            if (currentFilter.isRange) {
                if (/^\d+-\d+$/.test(text)) value = text
                else {
                    return await TGSendMessage(id, 'Ievadiet no-lidz. Piemēram: 1950-2025')
                }
            } else if (currentFilter.isSelectable) value = text
            else {
                const option = currentFilter.defaultOptions[0].find(e => e.text === text)
                value = option.value
            }
            CONVERSATIONS[id][activeLink].myFilter[CONVERSATIONS[id][activeLink].step] = value
            const filterText = addNextFilter(id)
            if (filterText) {
                await TGSendMessage(id, filterText)
            } else {
                await saveFilter(id, CONVERSATIONS[id][activeLink])
                await TGSendMessage(id, `Filtrs saglabats`)
                CONVERSATIONS[id][activeLink].inProgress = false
                CONVERSATIONS[id][activeLink].isActive = true
            }
        }
    } catch (error) {
        console.log(error, req.body)
    }
    finally {
        res.status(200).send('OK')
    }
}
function normalizeSsLink(url: string) {
    if (!url || typeof url !== 'string') {
        return null
    }
    url = url.trim();
    const regex = /^(https?:\/\/)?(www\.)?(m\.)?ss\.(lv|com)(\/.*)?$/i,
        match = url.match(regex);
    if (!match) return null
    const domain = match[4],
        path = match[5] || '/'
    return `https://www.ss.${domain}${path}`
}
function getFilterTextByMyFilter({ filter, myFilter }) {
    const text = myFilter.map(e => {
        const item = filter.find(_e => _e.id === e.id),
            name = item?.name || '',
            text = item.isRange
                ? `No ${e.value[0]} līdz ${e.value[1]}`
                : item.defaultOptions[0].find(_e => e.value === _e.value)?.text
                || ''
        return `<b>${name}</b>: ${text}`
    }).join('\n')
    return text
}
function addNextFilter(id: number) {
    const activeLink = Object.keys(CONVERSATIONS[id]).find(e => CONVERSATIONS[id][e].inProgress)
    ++CONVERSATIONS[id][activeLink].step
    if (CONVERSATIONS[id][activeLink].step >= CONVERSATIONS[id][activeLink].filter.length) {
        return ''
    } else {
        const filterText = generateFilterText(CONVERSATIONS[id][activeLink].filter[CONVERSATIONS[id][activeLink].step])
        return filterText
    }
}
function generateFilterText(e: any) {
    const text = `<b>${e.name}</b>: ${e.isRange && Array.isArray(e.defaultOptions)
        ? ((e.defaultOptions[0] as any).text + ' - ' + (e.defaultOptions[1] as any).text)
        : !e.defaultOptions && e.isRange ? 'no - līdz'
            : Array.isArray(e.defaultOptions) && Array.isArray(e.defaultOptions[0])
                ? (e.defaultOptions[0] as any[]).map(opt => `<code>${opt.text}</code>`).join(', ')
                : ''
        }\n/skip`
    return text
}
async function saveFilter(tgId: number, object: any) {
    try {
        const { title, link, filter, myFilter } = object
        const toSave = myFilter.map((e, i) => {
            const { id, isRange } = filter[i]
            if (!e) return false
            const obj = { id, value: isRange ? e.split('-') : e }
            return obj
        }).filter(e => e)
        const user = await ScrapperUserSchema.findOne({ tgId })
        const { _id } = await new ScrapperAdSchema({
            title,
            link,
            filter,
            myFilter: toSave
        }).save()
        if (!user) {
            await new ScrapperUserSchema({
                tgId,
                userName: CONVERSATIONS[tgId].username,
                isActive: true
            }).save()
        }
        await ScrapperUserSchema.updateOne({ tgId }, { $push: { adSubscribes: _id } })
        console.log('Save filter to DB')

    } catch (error) {
        console.log(error)
    }
}

async function getAdFilter(link: string) {
    try {
        const document = await getDocument(link),
            list = document.querySelectorAll('#filter_tbl .filter_name'),
            title = document.querySelector('.headtitle').textContent || '',
            filter = [...list].map(e => {
                const name = e.textContent?.split(':')[0] || '',
                    span = e.querySelector('span'),
                    id = +(span.id.split('_')?.[1] || 0),
                    children = span.children,
                    isRange = children.length === 2,
                    isSelectable = (children[0] as HTMLInputElement | HTMLSelectElement).type === 'select-one',
                    defaultOptions = isSelectable
                        ? [...children].map((e, i) => isRange ? (
                            i === 0
                                ? { text: (e as any)[(e as any).length - 1].text, value: (e as any)[(e as any).length - 1].value }
                                : { text: (e as any)[1].text, value: (e as any)[1].value }
                        )
                            : Array.from(e.children).filter((e: any) => e.text).map(_e => ({ text: (_e as any).text, value: (_e as any).value }))
                        ) : null
                return { name, id, isRange, isSelectable, defaultOptions }
            })
        return { title, filter }
    } catch (error) {
        console.log('getAdFilter error', error);
    } finally {

    }
}
async function getDocument(url: string, filter?: any) {
    try {
        url = filter ? `${url.replace('filter/', '')}filter/ ` : url
        filter && (await getCookie(url))
        const { data } = await client({
            method: filter ? 'POST' : 'GET',
            url,
            ...(filter && {
                data: filter,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        })
        const { document } = (new JSDOM(data)).window
        return document
    } catch (e: any) {
        console.log('SSLatestAd error | getDocument', e.message)
        return null
    }
}

function isSuitableLink(str: string) {
    return typeof str === 'string' &&
        /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(str);
}


let timeout
export default async function getLatestAds() {
    try {
        const users = await ScrapperUserSchema.find(
            { isActive: true, adSubscribes: { $not: { $size: 0 } } },
            { _id: true, adSubscribes: true, tgId: true }
        ).lean()
        const adIds = [...new Set(users.map(e => e.adSubscribes).flat())].filter(e => e)
        const activeAds = await ScrapperAdSchema.find({ _id: adIds }, { _id: true, title: true, link: true, myFilter: true, latestIds: true })
        if (!activeAds.length) return console.log('bububub');
        const ads: any = []
        for (let ad of activeAds) {
            const ss = await getSSAds(ad)
            if (!ss.length) continue
            ads.push({ _id: ad._id, list: ss })
        }
        for (let { _id, list } of ads) {
            const tgIds = users.filter(e => e.adSubscribes.some(e => e && e.equals(_id)))
                .map(e => e.tgId)
            await sendAdsToSubscribers(tgIds, list)
            const ids = list.map(e => e.id)
            await saveLatestIds(_id, ids)
        }
    } catch (e: any) {
        console.log('getLatestAds error', e.message);
    } finally {
        clearTimeout(timeout)
        timeout = setTimeout(getLatestAds, SEARCH_DELAY)
        return true
    }
}

async function parseAllAds(activeAds: ScrapperAdModel[],) {
    try {

    } catch (error) {
        console.log('error parseAllAds', error)
    }
}
async function sendAdsToSubscribers(tgIds: number[], ads: any) {
    for (let tgId of tgIds) {
        for (let { photos, description: caption } of ads) {
            if (photos?.length) {
                const res = await sendMediaGroup(tgId, photos.map((e, i) =>
                ({
                    type: 'photo',
                    media: e,
                    ...(i === 0 && { caption, parse_mode: 'HTML' })
                })))
            } else {
                await sendMessage(tgId, caption)
            }
        }
    }
}

async function saveLatestIds(_id: Types.ObjectId, ids: any) {
    try {
        await ScrapperAdSchema.updateOne({ _id }, {
            $addToSet: { latestIds: { $each: ids } }
        })
        return true
    } catch (error) {
        console.log('saveLatestIds error', error);
        return false
    }
}
async function getSSAds({ title, link, myFilter, latestIds }: ScrapperAdModel) {
    try {
        const filter: any = {}
        for (let e of myFilter as any) {
            if (typeof e.value === 'object') {
                filter.topt = {
                    ...filter.topt,
                    [e.id]: { min: e.value[0], max: e.value[1] }
                }
            } else {
                filter.opt = {
                    ...filter.opt,
                    [e.id]: e.value
                }
            }
        }
        const document = await getDocument(link, myFilter.length ? filter : null)
        if (!document) return []

        const pageAdList = document.querySelector('#head_line')?.parentElement?.querySelectorAll<HTMLAnchorElement>('tr:not(:first-child, :last-child)')
        if (!pageAdList?.length) return []

        const adsData = [...pageAdList].map(e => {
            const id = +(e?.id.substring(3) as string) || 0,
                link: string = e?.querySelector('a')?.href || ''
            return { id, link }
        }).filter(({ id, link }) => {
            if (!id || !link) return false
            if (latestIds.includes(id)) return false
            return true
        })
        const ads = await ssGetAds(title, adsData)
        return ads
    } catch (e: any) {
        console.log('Error ssSearch', e.message)
        return []
    }
}

async function ssGetAds(title: string, list: any) {
    const ads = []
    for (let { link, id } of list) {
        const document = await getDocument(link)
        if (!document) continue
        let adText = ''
        const msgList = document.querySelector('#msg_div_msg')?.children || []
        for (let i = 0; i < msgList.length; ++i) {
            if (msgList[i].nodeName === 'BR') {
                adText += `\n${msgList[i]?.previousSibling?.textContent?.trim()}` || ''
            }
        }
        const photos = [...document.querySelectorAll<HTMLAnchorElement>('.pic_dv_thumbnail a')]
            .map(e => e.href)
            .filter(e => e)
            .slice(0, 9)
        let optionsText = ''
        const priceDiv = document.querySelector('#tdo_8')
        if (priceDiv) {
            optionsText += `${document.querySelector('.ads_opt_name_big')?.textContent?.trim()} <b>${priceDiv.textContent?.trim()}</b>\n`
        }
        optionsText += [...document.querySelectorAll('.options_list tr tr')]
            .map(e => {
                const [key, value] = e.querySelectorAll('td')
                const newValue = (value.querySelector('b') || value)?.textContent || ''
                return `${key.textContent?.trim()} <b>${newValue?.trim()}</b>`
            })
            .join('\n')
        const footerList = document.querySelectorAll('.msg_footer')
        let date = ''
        for (let i = 0; i < footerList.length; ++i) {
            const text = footerList[i]?.textContent || ''
            if (text.includes('Дата') || text.includes('Datums')) {
                date = text.split(': ')[1]
            }
        }
        date && (optionsText += `\nDatums: <b>${date}</b>`);
        const description = `<b>${title}</b>\n${adText.substring(0, adText.length > 400 ? 400 : undefined).split(' ').slice(0, adText.length > 400 ? -1 : 9999999).join(' ')}${adText.length > 400 ? ' ...' : ''}\n\n${optionsText}\n\n<a href="${link}">${link}</a>`
        ads.push({
            id,
            photos,
            description
        })
    }
    return ads
} */