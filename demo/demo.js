const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
res.send('Hello World!')
})

app.use(express.static('./src'))
app.use(express.static('./dist'))
app.use(express.static('./coverage'))
app.use(express.static('./www'))

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})
