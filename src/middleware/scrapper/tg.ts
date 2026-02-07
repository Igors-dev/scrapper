import axios from "axios"
import { TELEGRAM_API } from '../../config/scrapper'
import fs from 'fs'
import FormData from 'form-data'
export async function TGSendMediaGroup(chat_id: number, media: any) {
    try {
        const { data } = await axios.post(`${TELEGRAM_API}/sendMediaGroup`, {
            chat_id,
            media,
        })
        return data
    } catch (e: any) { }
}
export async function TGSendMessage(chat_id: number, text: string) {
    try {
        const { data } = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        })
        return data
    } catch (e: any) { }
}

export async function TGSendVideo(chat_id: number, path: string) {
    const form = new FormData()
    form.append('chat_id', `${chat_id}`)
    form.append('video', fs.createReadStream(path))
    try {
        const { data } = await axios.post(`${TELEGRAM_API}/sendVideo`, {
            chat_id,
            video: fs.createReadStream(path),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        })
        /* const { data } = await axios.post(
            `${TELEGRAM_API}/sendMessage`,
            form,
            { headers: form.getHeaders() }
        ); */
        console.log('TGSendVideo Sent!', data);
    } catch (err) {
        console.error('TGSendVideo Error:', err.response?.data || err.message);
    }
}