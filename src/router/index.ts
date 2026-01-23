import express, { Express } from 'express'
import cors from 'cors'
import { ssRouter } from './ss'

export default function mainRouter(app: Express) {
    app.use(express.urlencoded({ limit: '50mb', extended: true }))
    app.use(express.json({ limit: '50mb' }))
    app.use(cors())
    app.use('/ss', ssRouter)
    // app.all('*', (req, res) => handle(req, res))
}