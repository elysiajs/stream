import { Elysia, t } from 'elysia'

import { html } from '@elysiajs/html'
import { staticPlugin } from '@elysiajs/static'
import { Stream } from '../src'

import { OpenAI } from 'openai'

const app = new Elysia()
    .use(html())
    .use(staticPlugin())
    .decorate('openai', new OpenAI({ apiKey: Bun.env.OPENAI_API_KEY }))
    .post(
        '/ai',
        ({ openai, body }) =>
            new Stream(
                openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    stream: true,
                    messages: body as any
                })
            ),
        {
            body: t.Array(
                t.Object({
                    role: t.String(),
                    content: t.String()
                })
            )
        }
    )
    .get('/chat', (chat) => (
        <html>
            <head>
                <title>ChatGPT</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body>
                <template id="ai-message">
                    <section class="flex gap-4 p-2.5 border rounded-lg">
                        <img
                            class="w-12 h-12 rounded-full object-cover object-center"
                            src="/public/aris-maid.png"
                            alt="Aris Maid"
                        />
                        <p class="text-lg w-full mt-2.5 whitespace-pre-wrap">
                            ...
                        </p>
                    </section>
                </template>

                <template id="user-message">
                    <section class="flex gap-4 p-2.5 bg-gray-100/75 rounded-lg">
                        <img
                            class="w-12 h-12 rounded-full object-cover object-center"
                            src="/public/aris.jpg"
                            alt="Aris"
                        />
                        <p class="text-lg w-full mt-2.5 whitespace-pre-wrap" />
                    </section>
                </template>

                <main class="flex flex-col justify-center items-center gap-3 w-full max-w-md min-h-screen mx-auto">
                    <section
                        id="chat"
                        class="flex flex-col flex-1 w-full gap-2 py-4"
                    />
                    <form
                        id="form"
                        class="sticky bottom-4 flex w-full px-1 rounded-lg bg-gray-100"
                    >
                        <input
                            id="messager"
                            placeholder="Send a message"
                            class="text-lg w-full p-2.5 bg-transparent outline-none"
                        />
                    </form>
                </main>

                <script>{`
                    const decoder = new TextDecoder()
                    const history = []

                    const parse = (input) => decoder
                        .decode(input)
                        .split('\\n\\n')
                        .filter(v => v)
                        .map(value => JSON.parse(value.slice(value.indexOf('data:') + 6)))

                    const template = {
                        ai: document.getElementById('ai-message'),
                        user: document.getElementById('user-message')
                    }
                    const chat = document.getElementById('chat')
                    const messager = document.getElementById('messager')

                    const createMessage = (word) => {
                        const element = {
                            ai: template.ai.content.cloneNode(true),
                            user: template.user.content.cloneNode(true)
                        }
                        element.user.firstElementChild.lastElementChild.textContent = word

                        chat.appendChild(element.user)
                        chat.appendChild(element.ai)
                    }

                    const updateMessage = (word) => {
                        chat.lastElementChild.lastElementChild.textContent = word
                    }

                    let processing = false

                    document
                        .getElementById('form')
                        .addEventListener('submit', async (event) => {
                            event.preventDefault()

                            if(processing)
                                return

                            const prompt = event.target[0].value

                            messager.value = ''
                            messager.setAttribute("disabled", true)

                            createMessage(prompt)

                            history.push({
                                role: 'user',
                                content: prompt
                            })

                            try {
                                const response = await fetch('/ai', {
                                    method: 'POST',
                                    headers: {
                                        'content-type': 'application/json'
                                    },
                                    body: JSON.stringify(history)
                                })
                                const reader = response.body.getReader()

                                let message = ''

                                while (true) {
                                    const { done, value } = await reader.read()

                                    for(const { choices } of parse(value))
                                        for(const { delta: { content } } of choices) {
                                            message += content ?? ''
                                            console.log(message)
                                        }

                                    updateMessage(message)

                                    if (done) {
                                        history.push({
                                            role: 'assistant',
                                            content: message
                                        })
        
                                        break
                                    }
                                }
                            } finally {
                                processing = false
                                messager.removeAttribute("disabled")                                
                            }
                        })
                `}</script>
            </body>
        </html>
    ))
    .listen(3000)
