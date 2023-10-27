import { Elysia } from 'elysia'
import { Stream } from '../src'
import { html } from '@elysiajs/html'

new Elysia()
    .use(html())
    .get(
        '/source',
        () =>
            new Stream((stream) => {
                stream.event = 'hi'
                stream.retry = 1000

                const interval = setInterval(() => {
                    stream.send('hello world')
                }, 500)

                setTimeout(() => {
                    clearInterval(interval)
                    stream.close()
                }, 3000)
            })
    )
    .get('/', () => (
        <html>
            <head>
                <title>Hello World</title>
                <script>{`
                const event = new EventSource('/source')

                event.addEventListener('message', (event) => {
                    console.log(event.data)
                })
            `}</script>
            </head>
            <body>
                <h1>Hello World</h1>
            </body>
        </html>
    ))
    .listen(3000)
