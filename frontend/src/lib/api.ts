import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  // Investigação: 3 chamadas Groq sequenciais com 20s de delay entre cada = até 90s + tempo de resposta
  timeout: 180_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Erros 429 — limite de requisição GroqCloud
    if (err.response?.status === 429) {
      err.message = 'Limite de requisições atingido. Aguarde alguns instantes e tente novamente.'
    }
    return Promise.reject(err)
  }
)

export default api
