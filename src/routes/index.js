import express from 'express'
import v1Route from './v1'
import { registerMiddleware } from '../middleware'

const router = express.Router({
  mergeParams: true
})

registerMiddleware(router)

router.use('/v1/:network', v1Route)

export default router
