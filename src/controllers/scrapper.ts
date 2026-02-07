import axios from 'axios'
import { TELEGRAM_API, API_URL, TG_TOKEN } from '../config/scrapper'
const instance = axios.create({
    baseURL: TELEGRAM_API,
    headers: {
        'Content-Type': 'application/json'
    }
})
const webhookURL = `${API_URL}/scrapper/webhook/${TG_TOKEN}`

export default async function setScrapperWebhook() {
    try {
        const isOk = await getScrapperWebhook()
        if (isOk) return console.log('Webhoook is already exist')
        const { data } = await instance.post('/setWebhook', { url: webhookURL })
        console.log(data);
        return data
    } catch (e: any) {
        console.log('setWebhook error', e.message)
        return false
    }
}
async function getScrapperWebhook() {
    try {
        const { data } = await instance.post('/getWebhookInfo', { url: webhookURL }),
            { ok, result } = data
        return (ok && !!result?.ip_address)
    } catch (e: any) {
        console.log('setWebhook error', e.message)
        return false
    }
}
async function deleteScrapperWebhook() {
    try {
        const { data } = await instance.post('/deleteWebhook', { drop_pending_updates: true })
        console.log(data)
        return data
    } catch (e: any) {
        console.log('setWebhook error', e.message)
        return false
    }
}