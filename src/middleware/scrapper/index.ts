import { client } from './axios-client'
import { TGSendMediaGroup, TGSendMessage, TGSendVideo } from './tg'
export const sendMediaGroup = TGSendMediaGroup
export const sendMessage = TGSendMessage
export const sendVideo = TGSendVideo
export async function getCookie(url: string) {
    await client.get(url)
    return true
}