import { Elysia, t } from 'elysia'

import { html } from '@elysiajs/html'
import { staticPlugin } from '@elysiajs/static'

import { OpenAI } from 'openai'
import { Stream } from '../src'

import { instruction } from './instruction'

const app = new Elysia()
    .use(html())
    .use(staticPlugin())
    .decorate('openai', new OpenAI({ apiKey: Bun.env.OPENAI_API_KEY }))
    .model(
        'openai.prompt',
        t.Array(
            t.Object({
                role: t.String(),
                content: t.String()
            })
        )
    )
    .post(
        '/ai',
        ({ openai, body }) =>
            new Stream(
                openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    stream: true,
                    messages: instruction.concat(body as any)
                })
            ),
        {
            body: 'openai.prompt'
        }
    )
    // ? You can stream from fetch to proxy response
    .post(
        '/ai/proxy',
        ({ body }) =>
            new Stream(
                fetch('http://localhost:3000/ai', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify(body)
                })
            ),
        {
            body: 'openai.prompt'
        }
    )
    .get('/', () => (
        <html>
            <head>
                <title>ArisGPT</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <script src="https://cdn.tailwindcss.com" />
            </head>
            <body>
                <template id="ai-message">
                    <section class="flex gap-2 p-2.5 border rounded-lg">
                        <img
                            class="w-12 h-12 min-w-12 rounded-full object-cover object-center"
                            src="/public/aris-maid.png"
                            alt="Aris Maid"
                        />
                        <p class="text-lg w-full mt-2.5 mb-1 px-2 whitespace-pre-wrap break-words">
                            ...
                        </p>
                    </section>
                </template>

                <template id="user-message">
                    <section class="flex gap-2 p-2.5 bg-gray-100/75 rounded-lg">
                        <img
                            class="w-12 h-12 min-w-12 rounded-full object-cover object-center"
                            src="/public/aris.jpg"
                            alt="Aris"
                        />
                        <p class="text-lg w-full mt-2.5 mb-1 px-2 whitespace-pre-wrap break-words" />
                    </section>
                </template>

                <main class="flex flex-col justify-center items-center gap-3 w-full max-w-xl min-h-screen mx-auto px-4">
                    <header class="sticky top-0 flex w-full p-2 bg-white border-b">
                        <h1 class="text-2xl font-medium">
                            Aris
                            <span class="font-normal text-blue-500">GPT</span>
                        </h1>
                    </header>
                    <section
                        id="chat"
                        class="flex flex-col flex-1 w-full gap-3 py-4"
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
                                const response = await fetch('/ai/proxy', {
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
                                messager.focus()
                            }
                        })
                `}</script>
            </body>
        </html>
    ))
    .listen(3000)
