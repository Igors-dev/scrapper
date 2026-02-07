import express from 'express';
import mainRouter from './router';
import connectDB from './models';
import setScrapperWebhook from './controllers/scrapper';
import getLatestAds from './services/scrapper';
import keepAlive from './utils/keepAlive';
const port = process.env.PORT || 3000;
(async () => {
    try {
        await connectDB()
        const app = express()
        app.listen(port, () => {
            mainRouter(app)
            setScrapperWebhook()
            getLatestAds()
            if (process.env.NODE_ENV !== 'development') {
                keepAlive()
            }
        })
    } catch (e: any) {
        console.log('Server error', e)
        process.exit(1)
    }
})()