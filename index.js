// server.js (Backend - Node.js + Express)
const express = require("express")
const cors = require("cors")
const { OpenAI } = require("openai")
const bodyParser = require("body-parser")
const rateLimit = require("express-rate-limit")
const mongoose = require("mongoose")
require("dotenv").config()
const axios = require("axios")
mongoose
	.connect(process.env.MONGO_URI, {})
	.then(() => console.log("MongoDB connected"))
	.catch((err) => console.error("MongoDB connection error:", err))

const app = express()
const PORT = process.env.PORT || 5000
const openai = new OpenAI({
	baseURL: "https://openrouter.ai/api/v1",
	apiKey: process.env.DEEPSEEK_API_KEY,
})

app.set("trust proxy", "loopback, linklocal, uniquelocal")

const RequestLogSchema = new mongoose.Schema(
	{
		ip: { type: String, required: true },
		message: { type: String, required: true },
		response: { type: String, required: true },
	},
	{ timestamps: true }
)

const RequestLog = mongoose.model("RequestLog", RequestLogSchema)

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(__dirname + "/public"))
app.use(bodyParser.urlencoded({ extended: true }))

app.set("views", __dirname + "/views")
app.set("view engine", "ejs")
app.use(express.static(__dirname + "public"))
// Mock database (Replace with MongoDB if needed)

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20, // limit each IP to 100 requests per windowMs
	// Remove any global limiter usage and create a new limiter instance for one route:

	message: "براحة شوية, إستنى ربعاية وتعلى تاني",
})

// Route: Fetch static university data
// app.get("/api/data", (req, res) => {
// 	res.json(universityData)
// })

// Route: AI-powered chatbot response
app.post("/api/chat", limiter, async (req, res) => {
	const { message } = req.body
	let rows
	try {
		const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/Sheet1?key=${process.env.GOOGLE_API_KEY}`
		const response = await fetch(url, {
			method: "GET",
		})
		const data = await response.json()
		rows = data.values
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "Failed to fetch data" })
	}

	// Convert rows to JSON (Assuming first row contains headers)
	const headers = rows[0]
	const promptData = rows.map((row) => ({ [row[0]]: row[1] }))
	const prompt = `Answer the question based on this university data: ${JSON.stringify(
		promptData
	)}
	You are supposed to help students with questions related to the provided data. and be their asistant
	If the question is not relevant to the provided data, respond with "
	مش عارف الصراحة. 
تقريبا الكلام دا يإما مش تبع الكلية أصلا, أو لسة مش عندي المعلومة.

حاول تسأل السؤال بطريقة تانية مثلا ممكن أفهمك وأقدر أساعد.

لو حابب تتأكد ابعت للمناديب البشر العاديين."
	
	If you are not sure whether the question is relevant to the provided data, try to give an answer from the data and note that you are not sure.
	also check if it is a thank you or greeting message or not and respond accordingly.
	Talk in Egyptian arabic dialect.
	Only respond with data you have that are relavenat to the question.
	If asken about a date, responf with the day name and dd/mm format.
	keep in mind that some words might be written in arabic letters while they are english words so always check for this.
	User: ${message}
	AI:`

	try {
		const aiResponse = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "system", content: prompt }],
		})
		const reply = aiResponse.choices[0].message.content

		// Log the request and response in the database
		await RequestLog.create({
			ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
			message: message,
			response: reply,
		})

		res.json({ message: reply })
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "AI request failed" })
	}
})

app.get("/", (req, res) => {
	res.render("index", { clientUrl: process.env.CLIENT_URL })
})
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
