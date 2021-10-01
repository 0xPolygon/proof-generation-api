import express from 'express'
import { registerMiddleware } from './middleware'
import v1Router from './routes/v1'

//
// Router
//

const router = express.Router({
  mergeParams: true
})

registerMiddleware(router)

// v1
router.use('/v1', v1Router) // TODO use verifyToken in production

export default router
