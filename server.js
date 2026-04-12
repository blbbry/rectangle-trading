import express from "express"
import cors from "cors"
import fetch from "node-fetch"
import dotenv from "dotenv"

dotenv.config()
console.log("SERPAPI_KEY:", process.env.SERPAPI_KEY)

const app = express()
app.use(cors())
app.use(express.json())

app.get("/price", async (req, res) => {
  const { item } = req.query

  if (!item) {
    return res.status(400).json({ error: "Item name required" })
  }

  try {
    const url = `https://serpapi.com/search.json?engine=ebay&ebay_domain=ebay.com&_nkw=${encodeURIComponent(item)}&LH_Sold=1&LH_Complete=1&api_key=${process.env.SERPAPI_KEY}`

    const response = await fetch(url)
    const data = await response.json()
    console.log("SerpApi error:", JSON.stringify(data.error))

    const results = data.organic_results?.slice(0, 10) || []
    console.log("First result price:", JSON.stringify(results[0]?.price))
    const rawPrices = results.flatMap(r => {
        if (r.price?.extracted) return [r.price.extracted]
        if (r.price?.from?.extracted) return [r.price.from.extracted]
        if (r.price?.to?.extracted) return [r.price.to.extracted]
        return []
    }).filter(p => !isNaN(p) && p > 0)

    const avg = rawPrices.reduce((a, b) => a + b, 0) / rawPrices.length
    const prices = rawPrices.filter(p => p <= avg * 2 && p >= avg * 0.25)   

    const avgPrice = prices.length
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : null

    const low = prices.length ? Math.round(Math.min(...prices)) : null
    const high = prices.length ? Math.round(Math.max(...prices)) : null

    res.json({ avgPrice, low, high, count: prices.length })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch prices" })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))