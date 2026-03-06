import createClient from 'openapi-fetch'
import type { paths } from './schema'

const client = createClient<paths>({
  baseUrl: '/api',
})

export default client
