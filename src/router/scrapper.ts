import express from 'express'
const router = express.Router()
import { initScrapperTelegramBot } from '../services/scrapper'
import { TG_TOKEN } from '../config/scrapper'
router.post(`/webhook/${TG_TOKEN}`, initScrapperTelegramBot)
export { router as scrapperRoute }