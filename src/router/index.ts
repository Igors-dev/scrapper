import express, { Express } from 'express'
import cors from 'cors'
import { ssRouter } from './ss'
import { scrapperRoute } from './scrapper'

export default function mainRouter(app: Express) {
    app.use(express.urlencoded({ limit: '50mb', extended: true }))
    app.use(express.json({ limit: '50mb' }))
    app.use(cors())
    app.get('/', (req, res) => res.send('Hello World!'))
    app.use('/ss', ssRouter)
    app.use('/scrapper', scrapperRoute)
}