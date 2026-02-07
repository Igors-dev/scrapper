import mongoose, { Document, Schema } from 'mongoose'
const AdSubscribesSchema = new Schema({
    _id: mongoose.Types.ObjectId,
    createdAt: { type: Date, default: Date.now },
    deletedAt: Date,
    stoppedAt: Date,
})
const ScrapperUserSchema = new Schema({
    tgId: Number,
    userName: String,
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    adSubscribes: [AdSubscribesSchema]
}, {
    versionKey: false
})

type AdSubscribes = {
    _id: mongoose.Types.ObjectId,
    createdAt: Date,
    deletedAt: Date,
    stoppedAt: Date
}

export type ScrapperUser = {
    tgId: number,
    userName: string,
    createdAt: Date,
    isActive: boolean,
    adSubscribes: AdSubscribes[]
}

export type ScrapperUserModel = Document & ScrapperUser

export default mongoose.connection.useDb('scrapper').model<ScrapperUserModel>('users', ScrapperUserSchema)