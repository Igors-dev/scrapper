import axios from 'axios'
import { TELEGRAM_API } from '../config/scrapper'

export async function sendMediaGroup(chat_id: number, media: any) {
    try {
        const { data } = await axios.post(`${TELEGRAM_API}/sendMediaGroup`, {
            chat_id,
            media,
        })
        return data
    } catch (e: any) {
        console.log('error Telegram sendMediaGroup', e);
    }
}
export async function sendMessage(chat_id: number, text: string) {
    try {
        const { data } = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        })
        return data
    } catch (e: any) {
        console.log('error Telegram sendMessage', e);

    }
}