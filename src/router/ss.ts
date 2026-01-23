import express from 'express'
const router = express.Router()

router.get(`/`, (req, res) => res.json({ hello: 123 }))
export { router as ssRouter }