
import mongoose from 'mongoose'
import ScrapperUserSchema, { ScrapperUserModel } from './scrapper/user'
import ScrapperAdSchema, { ScrapperAdModel } from './scrapper/ad'
import { DB_URI } from '../config/scrapper'

export default async function connectDB() {
    const db = mongoose.connection
    mongoose.set('strictQuery', false)
    await mongoose.connect(DB_URI, { autoIndex: false })
    console.log('Connect to DB')
    const mongooseDisconnect = async () => {
        console.log('Close DB')
        await db.close()
        process.exit(0)
    }
    process.on('SIGINT', mongooseDisconnect).on('SIGTERM', mongooseDisconnect)
}


export type {
    ScrapperUserModel, ScrapperAdModel

}
export {
    ScrapperUserSchema, ScrapperAdSchema
}