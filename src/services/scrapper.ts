import { Request, Response } from "express"
import { getCookie, sendMediaGroup, sendMessage } from "../middleware/scrapper"
import { client } from '../middleware/scrapper/axios-client'
import { JSDOM } from 'jsdom'
import { TGSendMessage, TGSendVideo } from "../middleware/scrapper/tg"
import { ScrapperAdModel, ScrapperAdSchema, ScrapperUserSchema } from "../models"
import { SEARCH_DELAY, SSConfig } from "../config/scrapper"
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

export async function initScrapperTelegramBot(req: Request, res: Response) {
    try {
        const { from, text }: ResponseMessage = req.body.message,
            { is_bot, id, first_name: username } = from
        if (is_bot || !text) return false
        if (!CONVERSATIONS[id]) {
            CONVERSATIONS[id] = { username }
        }
        const activeLink = Object.keys(CONVERSATIONS[id]).find(e => CONVERSATIONS[id][e]?.inProgress)
        if (text === '/start') {
            console.log('start')
            // await TGSendVideo(id, './public/howto.mp4')

        } else if (text.startsWith('/add')) {
            await parseLink({ id, text, username })
        } else if (text === '/skip') {
            await skipFilter({ id, activeLink })
        } else if (text === '/list') {
            await getAdsList({ id })
        } else if (text.startsWith('/delete')) {
            await modifyAd({ id, text, action: 'delete' })
        } else if (text.startsWith('/stop')) {
            await modifyAd({ id, text, action: 'stop' })
        } else if (text.startsWith('/start')) {
            await modifyAd({ id, text, action: 'start' })
        } else if (text.startsWith('/edit')) {
            await modifyAd({ id, text, action: 'edit' })
        } else if (text === '/cancel') {
            await cancelAd({ id, activeLink })
        } else {
            await defaultTgBotCommand({ id, text, activeLink })
        }
    } catch (error) {
        console.log('error initScrapperTelegramBot', error);
    } finally {
        res.status(200).send('OK')
    }
}
async function cancelAd({ id, activeLink }) {
    try {
        const isOk = CONVERSATIONS[id][activeLink]
        if (!isOk) {
            return await TGSendMessage(id, `Jums nav aktīvs sludinājums, ko atcelt!`)
        }
        delete CONVERSATIONS[id]
        await TGSendMessage(id, `Sludinājums veiksmīgi atcelts!`)
    } catch (error) {
        console.log('ērror cancelAd', error.message);

    }
}
async function editAd({ _id, id }) {
    try {
        const ad = await ScrapperAdSchema.findOne({ _id }, { title: true, link: true, filter: true, myFilter: true })
        if (!ad) return false
        const { title, link, filter } = ad
        CONVERSATIONS[id][link] = { _id, title, link, filter, myFilter: [], step: 0, inProgress: true, isActive: false, isEditing: true }
        const filterText = generateFilterText(filter[0])
        await TGSendMessage(id, `Filtrs: \n${filterText}`)
    } catch (error) {
        console.log('error editAd', error);
        return false
    }
}
function isSuitableLink(str: string) {
    return typeof str === 'string' &&
        /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(str);
}

async function parseLink({ id, text, username }) {
    try {
        const link = text.split('/add ')?.[1] || '',
            isOk = isSuitableLink(link)
        // const link = normalizeSsLink(text.split('/add ')?.[1] || '')
        if (!link || !isOk) {
            return await TGSendMessage(id, `Nav pareizs links! Ir jabūt ss.lv/ss.com bez m.ss`)
        }
        const { title, filter, error } = await getAdFilter(link)
        if (error) {
            return await TGSendMessage(id, `Nav pareizs links! Links jabūt uz noteiktu sludinājumu!`)
        }
        CONVERSATIONS[id] = {
            ...CONVERSATIONS[id],
            username,
            [link]: { title, link, filter, myFilter: [], step: 0, inProgress: true, isActive: false, isEditing: false }
        }
        const filterText = generateFilterText(filter[0])
        await TGSendMessage(id, `Filtrs: \n${filterText}`)
    } catch (error) {
        console.log('error parseLink', error);
        await TGSendMessage(id, `Kļūda parseLink: ${error.message}`)
    }
}

async function skipFilter({ id, activeLink }) {
    try {
        if (!activeLink) {
            return await TGSendMessage(id, `Jums nav aktivs filtrs`)
        }
        CONVERSATIONS[id][activeLink].myFilter[CONVERSATIONS[id][activeLink].step] = ''
        const filterText = addNextFilter({ id, activeLink })
        if (filterText) {
            await TGSendMessage(id, filterText)
        } else {
            await saveAd({ id, activeLink })
        }
    } catch (error) {
        console.log('error skipFilter', error);
        await TGSendMessage(id, `Kļūda skipFilter: ${error.message}`)
    }
}

async function getAdsList({ id }) {
    try {
        const user = await ScrapperUserSchema.findOne({ tgId: id }, { adSubscribes: true })
        if (!user) return await TGSendMessage(id, 'Jums nav sludinājumi!')
        const ads = await ScrapperAdSchema.find({ _id: user.adSubscribes.filter(e => !e.deletedAt).map(e => e._id) })
        const options = ads
            .map((e, i) => `${i + 1}. ${e.title}\n${e.link}\n${e.myFilter.length ? `${getFilterTextByMyFilter(e)}` : 'Nav filtrs'}\n<b>Sludinājuma status: ${user.adSubscribes.find(_e => _e._id.equals(e._id))?.stoppedAt ? 'Apstādināts' : 'Aktīvs'}</b>`)
            .join('\n\n')
        await TGSendMessage(id, ads.length ? `Jusu sludinājumi:\n${options}` : 'Jums nav sludinājumi')
    } catch (error) {
        console.log('error sendAdsList', error);
        await TGSendMessage(id, `Kļūda getAdsList: ${error.message}`)
    }
}
async function modifyAd({ id, text, action }) {
    try {
        const actions = {
            stop: ['stoppedAt', 'apstādināt'],
            start: ['stoppedAt', 'uzsākt'],
            delete: ['deletedAt', 'izdzēst'],
            edit: ['', 'izmainīt']
        }
        const index = +text.split(' ')?.[1]
        if (!index) return await TGSendMessage(id, `Ievadi sludinājuma nurumu, kuru vēlies ${actions[action][1]}!`)
        const user = await ScrapperUserSchema.findOne({ tgId: id }, { adSubscribes: true })
        if (!user) return await TGSendMessage(id, 'Jums nav tāds sludinājums')
        const adSubscribes = user.adSubscribes.filter(e => !e.deletedAt)
        if (!adSubscribes[index - 1]) {
            return await TGSendMessage(id, 'Nav tāds sludinājums!')
        }
        const { _id } = adSubscribes[index - 1]
        if (action !== 'edit') {
            await ScrapperUserSchema.findOneAndUpdate({ tgId: id, 'adSubscribes._id': _id }, {
                $set: { [`adSubscribes.$.${actions[action][0]}`]: action === 'start' ? null : new Date }
            })
        } else {
            return await editAd({ _id, id })
        }
        await TGSendMessage(id, `Sludinājums ir veiksmīgi ${actions[action][1]}s!`)
    } catch (error) {
        console.log('error deleteAd', error);
        await TGSendMessage(id, `Kļūda modifyAd: ${error.message}`)
    }
}

async function defaultTgBotCommand({ id, text, activeLink }) {
    try {
        if (!activeLink) {
            return await TGSendMessage(id, `Nav aktivs filtrs`)
        }
        let value = ''
        const currentFilter = CONVERSATIONS[id][activeLink].filter[CONVERSATIONS[id][activeLink].step]
        if (currentFilter.isRange) {
            if (/^\d+-\d+$/.test(text)) {
                if (currentFilter.defaultOptions) {
                    const [min, max] = text.split('-'),
                        currentMin = +currentFilter.defaultOptions[0].value,
                        currentMax = +currentFilter.defaultOptions[1].value
                    if (+min < currentMin) {
                        return await TGSendMessage(id, `Minimalām skaitlīm jabūt vairāk, vai vienādām ar ${currentMin}`)
                    } else if (+max > currentMax) {
                        return await TGSendMessage(id, `Maksimālām skaitlīm jabūt mazāk vai vienādām ar ${currentMax}`)
                    }
                }
                value = text
            }
            else {
                return await TGSendMessage(id, 'Ievadiet no-lidz. Piemēram: 1950-2025')
            }
        } else if (currentFilter.isSelectable || !currentFilter.defaultOptions) {
            if (currentFilter.isSelectable && !currentFilter.defaultOptions.find(e => e.text === text)) {
                return await TGSendMessage(id, 'Kļūda! Lūdzu izvēlēties no saraksta!')
            }
            value = text
        }
        else {
            const option = currentFilter.defaultOptions[0].find(e => e.text === text)
            value = option.value
        }
        CONVERSATIONS[id][activeLink].myFilter[CONVERSATIONS[id][activeLink].step] = value
        const filterText = addNextFilter({ id, activeLink })
        if (filterText) {
            await TGSendMessage(id, filterText)
        } else {
            await saveAd({ id, activeLink })
        }
    } catch (error) {
        console.log('error defaultTgBotCommand', error);
    }
}

async function saveAd({ id, activeLink }) {
    try {
        const { isEditing, _id, myFilter } = await saveFilter(id, CONVERSATIONS[id][activeLink])
        const adsData = await getLatestAdsData(activeLink, myFilter),
            ids = adsData.map(e => e.id)
        const adId = isEditing ? CONVERSATIONS[id][activeLink]._id : _id
        await saveLatestIds(adId, ids)
        await TGSendMessage(id, `Filtrs veiksmīgi ${isEditing ? 'izmainīts' : 'saglābāts'}!`)
        delete CONVERSATIONS[id]
        return true
    } catch (error) {
        console.log('Error saveAd', error);
        return false
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
    try {
        const text = myFilter.map(e => {
            const item = filter.find(_e => _e.id === e.id),
                name = item?.name || '',
                text = item.isRange
                    ? `No ${e.value[0]} līdz ${e.value[1]}`
                    : e.value
                    || ''
            return `<b>${name}</b>: ${text}`
        }).join('\n')
        return text
    } catch (error) {
        console.log('error getFilterTextByMyFilter', error, filter, myFilter);
    }
}
function addNextFilter({ id, activeLink }) {
    ++CONVERSATIONS[id][activeLink].step
    if (CONVERSATIONS[id][activeLink].step >= CONVERSATIONS[id][activeLink].filter.length) {
        return ''
    } else {
        const filterText = generateFilterText(CONVERSATIONS[id][activeLink].filter[CONVERSATIONS[id][activeLink].step])
        return filterText
    }
}
function generateFilterText(e: any) {
    const text = `<b>${e.name}</b>: ${e.isRange && e.defaultOptions?.length
        ? (e.defaultOptions[0].text + ' - ' + e.defaultOptions[1].text)
        : e.isRange && !e.defaultOptions ? 'no-līdz'
            : e.isSelectable
                ? e.defaultOptions.map(opt => `<code>${opt.text}</code>`).join(', ')
                : ''
        }\n/skip`
    return text
}
async function saveFilter(tgId: number, object: any): Promise<{ _id?: Types.ObjectId, myFilter: object, isEditing: boolean }> {
    try {
        const { _id: adId, isEditing, title, link, filter, myFilter } = object
        const toSave = myFilter.map((e, i) => {
            const { id, isRange } = filter[i]
            if (!e) return false
            const obj = { id, value: isRange ? e.split('-') : e }
            return obj
        }).filter(e => e)
        const user = await ScrapperUserSchema.findOne({ tgId })
        if (isEditing) {
            await ScrapperAdSchema.updateOne({ _id: adId }, {
                $set: { myFilter: toSave }
            })
            return { myFilter: toSave, isEditing }
        }
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
        console.log('Save filter to DB')
        await ScrapperUserSchema.updateOne({ tgId }, { $push: { adSubscribes: { _id } } })
        return { _id, myFilter: toSave, isEditing }

    } catch (error) {
        console.log(error)
    }
}

async function getAdFilter(link: string) {
    try {
        const document = await getDocument(link),
            list = document.querySelectorAll('#filter_tbl .filter_name')
        if (!list?.length) {
            return { error: 'Nepareizs links' }
        }
        const title = document.querySelector('.headtitle').textContent || '',
            filter = [...list].map(e => {
                const name = e.textContent?.split(':')[0] || '',
                    span = e.querySelector('span'),
                    id = +(span.id.split('_')?.[1] || 0),
                    children = span.children,
                    isRange = children.length === 2,
                    isYear = ['Gads', 'Год', 'Year'].includes(name),
                    isSelectable = (children[0] as HTMLInputElement | HTMLSelectElement).type === 'select-one',
                    defaultOptions = isSelectable
                        ? [...children].map((e, i) => isRange ? (
                            i === 0
                                ? { text: (e as any)[1].text, value: (e as any)[1].value }
                                : { text: (e as any)[(e as any).length - 1].text, value: (e as any)[(e as any).length - 1].value }
                        )
                            : Array.from(e.children).filter((e: any) => e.text).map(_e => ({ text: (_e as any).text, value: (_e as any).value }))
                        )[`${isYear ? 'reverse' : 'flat'}`]() : null
                return { name, id, isRange, isSelectable, defaultOptions }
            })
        return { title, filter }
    } catch (error) {
        console.log('getAdFilter error', error);
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

async function getLatestAdsData(link: string, adFilter: any) {
    try {
        const filter: any = {}
        for (let e of adFilter as any) {
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
        const document = await getDocument(link, adFilter.length ? filter : null)
        if (!document) return []
        const pageAdList = document.querySelector('#head_line')?.parentElement?.querySelectorAll<HTMLAnchorElement>('tr:not(:first-child, :last-child)')
        const data = [...pageAdList].map(e => {
            const id = +(e?.id.substring(3) as string) || 0,
                link: string = e?.querySelector('a')?.href || ''
            return { id, link }
        }).filter(({ id, link }) => {
            if (!id || !link) return false
            return true
        })
        return data
    } catch (error) {
        console.log('error getLatestAdsId', error);
        return []
    }
}

let timeout: any
export default async function getLatestAds() {
    try {
        const users = await ScrapperUserSchema.find(
            { isActive: true, adSubscribes: { $not: { $size: 0 } } },
            { _id: true, tgId: true, adSubscribes: true }
        ).lean()
        // const adIds = [...new Set(users.map(e => e.adSubscribes).flat())].filter(e => e)
        for (let user of users) {
            const adIds = user.adSubscribes.filter(e => !e.deletedAt && !e.stoppedAt).map(e => e._id),
                activeAds = await ScrapperAdSchema.find({ _id: adIds }, { _id: true, title: true, link: true, myFilter: true, latestIds: true })
            if (!activeAds.length) return console.log(`${user.tgId}, bububub`)
            const ads: any = []
            for (let ad of activeAds) {
                const list = await getActualAds(ad)
                if (!list.length) continue
                ads.push({ _id: ad._id, list })
            }
            for (let { _id, list } of ads) {
                await sendAdsToSubscribers([user.tgId], list)
                const ids = list.map(e => e.id)
                await saveLatestIds(_id, ids)
            }
        }
    } catch (e: any) {
        console.log('getLatestAds error', e.message);
    } finally {
        clearTimeout(timeout)
        timeout = setTimeout(getLatestAds, SEARCH_DELAY)
        return true
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
async function getActualAds({ title, link, myFilter, latestIds }: ScrapperAdModel) {
    try {
        const ads = []
        const adsData = (await getLatestAdsData(link, myFilter)).filter(e => !latestIds?.includes(e.id))
        for (let { link, id } of adsData) {
            const document = await getDocument(link)
            if (!document) continue
            const adContext = await getAdContext({ document, link, title })
            if (adContext) {
                ads.push({ id, ...adContext })
            }
        }
        return ads
    } catch (e: any) {
        console.log('Error ssSearch', e.message)
        return []
    }
}

async function ssGetAds(title: string, list: any) {
    try {

    } catch (error) {

    }
    const ads = []
    for (let { link, id } of list) {
        const document = await getDocument(link)
        if (!document) continue
        const adContext = await getAdContext({ document, link, title })
        if (adContext) {
            ads.push({ id, ...adContext })
        }
    }
    return ads
}

async function getAdContext({ document, link, title }: { document: Document, link: string, title: string }) {
    try {
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
        return { photos, description }
    } catch (error) {
        console.log('error getAdContext', error);
        return null
    }
}

type Filter = {
    name: string,
    ids: string[],
    isInputable: boolean,
    isSelectable: boolean,
    options: string[][][]
}

async function _getFilterByLink(link: string): Promise<Filter[]> | null {
    try {
        const document = await getDocument(link)
        const media = link.includes('m.ss') ? 'mobile' : 'main',
            list = document.querySelectorAll(SSConfig[media].selectors.filter.list)
        console.log(media);

        const filter = [...list].map(e => {
            const name = e.textContent.split(':')[0],
                isSelectable = !!e.querySelector('select'),
                isInputable = !!e.querySelector('input'),
                ids = [...e.querySelectorAll('input, select')].map(e => e.getAttribute('name')),
                options = isSelectable
                    ? [...e.querySelectorAll('select')].map(e => [...e.querySelectorAll('option')]
                        .filter(e => e.textContent)
                        .map(e => [e.value, e.textContent]))
                    : []
            return { name, ids, options, isSelectable, isInputable }
        })
        return filter
    } catch (error) {
        console.log('error _getFilterByLink', error)
        return null
    }
}