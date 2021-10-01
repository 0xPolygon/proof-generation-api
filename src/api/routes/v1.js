import express from 'express'

// create v1 router
const router = express.Router({
  mergeParams: true
})

var mumbai = require('./v1/mumbai')
router.use('/mumbai', mumbai)

var matic = require('./v1/matic')
router.use('/matic', matic)

// export router
export default router
