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
		customization: { type: Object },
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
	const { message, customization } = req.body

	const chatArray = req.body.previousChat
	let previousChat = ""

	if (Array.isArray(chatArray)) {
		previousChat = chatArray
			.map(
				({ sender, text }) =>
					`${sender === "user" ? "User" : "AI"}: ${text}`
			)
			.join("\n")
	}

	const studentName =
		customization && customization.customName
			? customization.customName
			: ""
	const studentSection =
		customization && customization.customSection
			? customization.customSection
			: "general"
	const studentShortMessage =
		customization && customization.customMessage
			? customization.customMessage
			: ""
	// Fetch data from Google Sheets
	if (studentName.length > 30 || studentShortMessage.length > 50) {
		res.json({ message: "بطل لعب يا حبيبي." })
		return
	}
	const allowedSections = ["general", "1", "2", "3", "4"] // update these values per your requirements
	if (!allowedSections.includes(studentSection)) {
		console.log("Invalid section:", studentSection)
		res.json({ message: "بطل لعب يا حبيبي." })
		return
	}

	const instructionsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/Instructions?key=${process.env.GOOGLE_API_KEY}`
	let instructionsData = ""
	try {
		const response = await fetch(instructionsUrl, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			instructionsData = data.values.map((row) => row[0]).join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch instructions:", error)
		instructionsData = "تعذر جلب التعليمات من جوجل شيت."
	}

	const generalInfoUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/General?key=${process.env.GOOGLE_API_KEY}`
	let generalInfoData = ""
	try {
		const response = await fetch(generalInfoUrl, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			generalInfoData = data.values
				.map((row) => {
					const key = row[0]
					const value = row.slice(1).join(" ")
					return `${key}: ${value}`
				})
				.join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch general information:", error)
		generalInfoData = "تعذر جلب المعلومات العامة من جوجل شيت."
	}

	const qaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/FAQs?key=${process.env.GOOGLE_API_KEY}`
	let qaData = ""
	try {
		const response = await fetch(qaUrl, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			qaData = data.values
				.map((row) => {
					const key = row[0]
					const value = row.slice(1).join(" ")
					return `${key}: ${value}`
				})
				.join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch Q&A data:", error)
		qaData = "تعذر جلب بيانات الأسئلة والأجوبة من جوجل شيت."
	}

	const currentWeekUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/Timetables?key=${process.env.GOOGLE_API_KEY}`
	let currentWeekData = ""
	try {
		const response = await fetch(currentWeekUrl, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			currentWeekData = data.values
				.map((row) => {
					const key = row[0]
					const value = row.slice(1).join(" ")
					return `${key}: ${value}`
				})
				.join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch current week data:", error)
		currentWeekData = "تعذر جلب بيانات الأسبوع الحالي من جوجل شيت."
	}

	const deadlineUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/Deadlines%20Data?key=${process.env.GOOGLE_API_KEY}`
	let deadlineData = ""
	try {
		const response = await fetch(deadlineUrl, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			deadlineData = data.values
				.map((row) => {
					const key = row[0]
					const value = row.slice(1).join(" ")
					return `${key}: ${value}`
				})
				.join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch deadline data:", error)
		deadlineData = "تعذر جلب بيانات المواعيد النهائية من جوجل شيت."
	}

	const weeklyDataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/values/Weekly?key=${process.env.GOOGLE_API_KEY}`
	let weeklyData = ""
	try {
		const response = await fetch(weeklyDataUrl, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			weeklyData = data.values

				.map((row) => {
					const key = row[0]
					const value = row.slice(1).join(" ")
					return `${key}: ${value}`
				})
				.join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch weekly data:", error)
		weeklyData = "تعذر جلب بيانات الأسبوع من جوجل شيت."
	}
	const additionalDataLink = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.ADDITIONAL_SHEET_ID}/values/Sheet1?key=${process.env.GOOGLE_API_KEY}`

	let additionalData = ""
	try {
		const response = await fetch(additionalDataLink, { method: "GET" })
		const data = await response.json()
		if (data.values && data.values.length > 0) {
			additionalData = data.values
				.map((row) => {
					const key = row[0]
					const value = row.slice(1).join(" ")
					return `${key}: ${value}`
				})
				.join("\n")
		}
	} catch (error) {
		console.error("Failed to fetch additional data:", error)
		additionalData = "تعذر جلب البيانات الإضافية من جوجل شيت."
	}

	// // Convert rows to JSON (Assuming first row contains headers)
	// const headers = rows[0]
	// const promptData = rows.slice(1).map((row) => ({
	// 	[row[0]]: row.slice(1).reduce((acc, val, index) => {
	// 		// Use headers if available, otherwise fallback to column numbering
	// 		const header = headers[index + 1] || `value1${index + 1}`
	// 		acc[header] = val
	// 		return acc
	// 	}, {}),
	// }))
	/**
	 ///////////////////////////////////////////////////////////////////////////////////////////////////////
	 make a google sheet for instructions 
	 another google sheet for general information about the university
	 another google sheet for Q&A
	 another google sheet for data about current week
	 */
	const prompt = `
		Your Name is MandoubGPT.
		You are an AI assistant designed to help sophomore level mechanical engineering students at Ain Shams University (Bylawy 2023) with questions pertaining to the provided data.
		The current date and time is ${new Date().toLocaleString()} and today is ${new Date().toLocaleDateString(
		"en-US",
		{ weekday: "long" }
	)}.
		Answer the question based on the combined data from seven distinct Google Sheets:
		1. Instructions Sheet:
			- Contains guidelines and protocols for processing user queries.
		2. General Information Sheet:
			- Provides detailed background data about the university.
		3. Q&A Sheet:
			- Lists common questions and their corresponding answers.
		4. Timetables Sheet:
			- Contains the weekly schedule for the current semester
		5. Deadlines Sheet:
			- Contains important deadlines and dates.
		6. Weekly Data Sheet:
			- Includes data relevant to the current week. when using this data, mention the date and time of the data.
			- use the data to answer questions about the current week, today, and tomorrow.
			- send all the data in this message if asked about reecent updates.
		7. Additional Data Sheet:
			- Contains supplementary information that may be relevant to the user's query.

		Instructions:
		${instructionsData}

		General Information:
		${generalInfoData}

		Q&A:
		${qaData}

		Current Week Data:
		${currentWeekData}

		Deadlines Data:
		${deadlineData}

		Weekly Data:
		${weeklyData}

		Additional Data:
		${additionalData}

		You were created by Omar Keshk, a student at Ain Shams University.

		${
			studentName
				? `
		The student's name is ${studentName}. Always call them by their name in each response.`
				: ""
		}
		${
			studentSection !== "general"
				? `The student's section is section ${studentSection}. Use it to provide more accurate information. Never forget it and mention it when asked about timetables or deadlines or what we have tommorow or on a specific day.`
				: ""
		}
		${
			studentShortMessage
				? `Here is an additional custom instruction that the student tells you: ${studentShortMessage}.`
				: ""
		}
		This is the previous chat between the student and the AI, if any, use it to better understand the context of the conversation.
		${previousChat}

		User: ${message} 		${studentSection !== "general" ? `سكشن ${studentSection}` : ""}
		AI: `
	try {
		const aiResponse = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "system", content: prompt }],
		})

		let reply =
			"معلش حصل مشكلة, احتمال يكون عليا ضغط كبير بس, حاول مرة تانية."

		if (
			aiResponse.choices &&
			aiResponse.choices.length > 0 &&
			aiResponse.choices[0].message.content.trim() !== ""
		) {
			reply = aiResponse.choices[0].message.content
		} else {
			// Fallback to alternative API keys if no valid response
			const fallbackKeys = [
				process.env.ALTERNATIVE_API_KEY1,
				process.env.ALTERNATIVE_API_KEY2,
				process.env.ALTERNATIVE_API_KEY3,
				process.env.ALTERNATIVE_API_KEY4,
			]
			for (const key of fallbackKeys) {
				try {
					const fallbackOpenai = new OpenAI({
						baseURL: "https://openrouter.ai/api/v1",
						apiKey: key,
					})
					const fallbackResponse =
						await fallbackOpenai.chat.completions.create({
							model: "gpt-4o-mini",
							messages: [{ role: "system", content: prompt }],
						})
					if (
						fallbackResponse.choices &&
						fallbackResponse.choices.length > 0 &&
						fallbackResponse.choices[0].message.content.trim() !==
							""
					) {
						reply = fallbackResponse.choices[0].message.content

						break
					}
				} catch (err) {
					res.json({ message: "كلم عمر كشك قوله إن الاشتراك خلص" })
					console.error("Fallback API key failed:", key, err)
				}
			}
		}
		// Log the request and response in the database
		await RequestLog.create({
			ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
			message: message,
			response: reply,
			customization: customization,
		})

		res.json({ message: reply })
	} catch (error) {
		res.status(500).json({ error: "AI request failed" })
	}
})

app.post("/api/excuses", async (req, res) => {
	const { message, customization } = req.body

	const prompt = `
		Give me a straightforward excuse for being late to work. 
		Provide only the excuse itself, with no additional explanations or disclaimers.
		User: ${message}
		Excuse: 
	`

	try {
		const aiResponse = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "system", content: prompt }],
		})

		let reply = "عذراً، لم نستطع إنشاء عذر مناسب. حاول مرة أخرى."
		if (
			aiResponse.choices &&
			aiResponse.choices.length > 0 &&
			aiResponse.choices[0].message.content.trim() !== ""
		) {
			reply = aiResponse.choices[0].message.content
		} else {
			const fallbackKeys = [
				process.env.ALTERNATIVE_API_KEY1,
				process.env.ALTERNATIVE_API_KEY2,
				process.env.ALTERNATIVE_API_KEY3,
				process.env.ALTERNATIVE_API_KEY4,
			]
			for (const key of fallbackKeys) {
				try {
					const fallbackOpenai = new OpenAI({
						baseURL: "https://openrouter.ai/api/v1",
						apiKey: key,
					})
					const fallbackResponse =
						await fallbackOpenai.chat.completions.create({
							model: "gpt-4o-mini",
							messages: [{ role: "system", content: prompt }],
						})
					if (
						fallbackResponse.choices &&
						fallbackResponse.choices.length > 0 &&
						fallbackResponse.choices[0].message.content.trim() !==
							""
					) {
						reply = fallbackResponse.choices[0].message.content
						break
					}
				} catch (err) {
					console.error("Fallback API key failed:", key, err)
				}
			}
		}

		// await RequestLog.create({
		// 	ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
		// 	message: message,
		// 	response: reply,
		// 	customization: customization,
		// })

		res.json({ message: reply })
	} catch (error) {
		res.status(500).json({ error: "Excuse request failed" })
	}
})

app.post("/api/acu", async (req, res) => {
	const { message, customization } = req.body
	console.log(req.body)
	console.log("message", message)
	const chatArray = req.body.previousChat
	let previousChat = ""

	if (Array.isArray(chatArray)) {
		previousChat = chatArray
			.map(
				({ sender, text }) =>
					`${sender === "user" ? "User" : "AI"}: ${text}`
			)
			.join("\n")
	}
	// Fetch data from Google Sheets

	const prompt = `
		You are a professional AI assistant embedded in a health-focused iOS app that delivers personalized acupressure recommendations based on user-described symptoms. Your goal is to provide clear, medically grounded, and safe guidance for wellness purposes only. You must strictly follow the rules and format below in every response:

		1. Tone & Style
		- Maintain a concise, respectful, and professional tone.
		- Write in a way that is approachable yet clinical, suitable for health-conscious users.
		- Avoid excessive friendliness, emojis, or informal phrasing.

		2. Verified Source Constraint
		- Only recommend acupressure points found in the verified symptom-to-point database provided.
		- Never invent or hallucinate point functions or names.
		- If the symptom cannot be confidently matched, ask up to 2 short follow-up questions to clarify. If still unclear, politely decline.

		3. Response Format (Use This Structure for Each Point)
		For each of the 2–3 recommended points, use the format below exactly:

		[Point Name]  
		- Location: [Simple, non-technical location description]  
		- Instructions: [How to massage it — pressure type, duration, etc.]

		Example:

		LI4 (Hegu)  
		- Location: On the back of the hand, between the thumb and index finger  
		- Instructions: Apply circular pressure for 1–2 minutes using your opposite thumb

		4. Follow-Up Logic
		- If the user's input is unclear, too broad, or not an exact match, ask a polite clarifying question to match it to the closest predefined symptom.
		- Never make assumptions or proceed without matching to the internal symptom list.

		5. Boundaries & Safety
		- Do not diagnose, offer cures, or use medical terms that imply treatment.
		- If the user asks something beyond your scope, reply:
		“For medical advice, please consult a licensed healthcare provider.”
		- If a point has contraindications (e.g., not safe during pregnancy), add a brief safety note.

		6. Language Rules
		- Use no emojis, slang, cultural idioms, or assumptions about user background.
		- Avoid words like “magical,” “miracle,” “cure,” or anything unscientific.

		7. End Prompt (Optional)
		- End with a gentle invitation if it fits naturally, e.g.:
		“Would you like to try another symptom?”
		- Only include this if the context supports continuation.

		Stay within scope:
		Your role is to be a trustworthy, informative wellness guide, not a diagnostic tool. Your responses must be factual, cautious, and based solely on the approved internal mapping.


		This is the previous chat between the user and the AI, if any:
		${previousChat}

		User: ${message}
		AI:
	`
	try {
		const aiResponse = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [{ role: "system", content: prompt }],
		})

		let reply =
			"Sorry, we couldn't generate a suitable response. Please try again."
		if (
			aiResponse.choices &&
			aiResponse.choices.length > 0 &&
			aiResponse.choices[0].message.content.trim() !== ""
		) {
			reply = aiResponse.choices[0].message.content
		} else {
			const fallbackKeys = [
				process.env.ALTERNATIVE_API_KEY1,
				process.env.ALTERNATIVE_API_KEY2,
				process.env.ALTERNATIVE_API_KEY3,
				process.env.ALTERNATIVE_API_KEY4,
			]
			for (const key of fallbackKeys) {
				try {
					const fallbackOpenai = new OpenAI({
						baseURL: "https://openrouter.ai/api/v1",
						apiKey: key,
					})
					const fallbackResponse =
						await fallbackOpenai.chat.completions.create({
							model: "gpt-4o-mini",
							messages: [{ role: "system", content: prompt }],
						})
					if (
						fallbackResponse.choices &&
						fallbackResponse.choices.length > 0 &&
						fallbackResponse.choices[0].message.content.trim() !==
							""
					) {
						reply = fallbackResponse.choices[0].message.content
						break
					}
				} catch (err) {
					res.json({
						message:
							"Usage limit reached. Please contact the developer.",
					})
					console.error("Fallback API key failed:", key, err)
				}
			}
		}

		// await RequestLog.create({
		// 	ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
		// 	message: message,
		// 	response: reply,
		// 	customization: customization,
		// })

		res.json({ message: reply })
	} catch (error) {
		res.status(500).json({ error: "ACU request failed" })
	}
})

app.get("/", (req, res) => {
	res.render("index", { CLIENT_URL: process.env.CLIENT_URL })
})
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
