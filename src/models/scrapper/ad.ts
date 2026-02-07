import mongoose, { Document, Schema } from 'mongoose'
const ScrapperAdSchema = new Schema({
    type: String,
    createdAt: { type: Date, default: Date.now },
    deletedAt: Date,
    latestIds: [Schema.Types.Mixed],
    title: String,
    link: String,
    filter: [],
    myFilter: [],
}, {
    versionKey: false
})

export type ScrapperAd = {
    type: string,
    createdAt: Date,
    deletedAt?: Date,
    title: string,
    link: string,
    latestIds: any,
    filter: object[],
    myFilter: object[],
}

export type ScrapperAdModel = Document & ScrapperAd

export default mongoose.connection.useDb('scrapper').model<ScrapperAdModel>('ads', ScrapperAdSchema)