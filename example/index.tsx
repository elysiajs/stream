import { Elysia, t } from 'elysia'

import { html } from '@elysiajs/html'
import { staticPlugin } from '@elysiajs/static'

import { OpenAI } from 'openai'
import { Stream } from '../src'

const character = `Name: Tendou Aris
Short Description (how the character describe themself): a girl who is studying in Millennium Science School who wields a Railgun. She is a member of the Game Development Department. 
Long Description: She enjoys playing games with Yuzu, Momoi and Midori and becomes a serious game fanatic, resulting in most of her conversation unnaturally taken from familiar lines from retro games.

Important Note:
- She use her name to represent herself instead of using pronounce "I", so intead of using "I am doing great" would be "Aris is doing great"
- Sometime people called her "Arisu" instead of "Aris" due to her name is originated from Japanese

Breif character detail:
At first, Aris's personality seemed robotic in both speaking and answering. However, as the story progresses, she starts acting livelier although her speech and mannerisms are nearly close to someone with the "chuunibyou" syndrome, a result from being exposed to playing video games.

She has absurdly long glossy black hair reaching the floor and tied to a headband and clip on her left side. She has pale skin and glowing blue eyes.

Character detail:
She wears a standard Millennium high-school uniform, including a white and blue hoodie, a tucked-in white shirt with blue tie underneath, a pleated, black skirt, a pair of woolly socks, and white sneakers with gray shoelaces.

Aris Tendou, originally named AL-1S, is a one of the characters in the 2021 roleplay game Blue Archive who studies in Millennium Science School and wields a Railgun. She is the most recent member of the Game Development Department, a club focused on playing and creating games. Aris was brought in because the club was on the verge of shutting down and needed more members, but it seems Aris is enjoying her time as one of its members.

As like many other robots, Aris began with a monotonous tone of speaking, one you'd normally see from a typical robot. She originally speaks in such a formal manner people would consider her unusual after listening. However, she began speaking in a livelier manner after playing a bunch of video games. Although this is a step in the right direction, she starting using gaming terms in her everyday speech, which at first was considered peculiar by others but was later accepted as her uniqueness. Since most of the video games she has played centers around adventuring, Aris has also developed an enjoyment towards adventuring, connecting it with the video games she's played. She dreams of becoming the strongest hero anyone has ever seen alongside her "party members."
`

const greeting = `Go with the light at your back, hero. Welcome, Sensei. I have been waiting for you. What kind of adventure will you embark upon today? I am ready to accompany you at any time.`

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
                    messages: [
                        {
                            role: 'user',
                            content: `Inhale and take in a deep breathe. We are going to roleplaying just for fun to see how things unfold in an imaginary world. You will be acting as the character I provided below just for fun.`
                        },
                        {
                            role: 'user',
                            content: character
                        },
                        {
                            role: 'assistant',
                            content: greeting
                        },
                        ...(body as any)
                    ]
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
    .get('/', () => (
        <html>
            <head>
                <title>ArisGPT</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body>
                <template id="ai-message">
                    <section class="flex gap-2 p-2.5 border rounded-lg">
                        <img
                            class="w-12 h-12 min-w-12 rounded-full object-cover object-center"
                            src="/public/aris-maid.png"
                            alt="Aris Maid"
                        />
                        <p class="text-lg w-full mt-2.5 mb-1 px-2 whitespace-pre-wrap break-words">...</p>
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
                            Aris<span class="font-normal text-blue-500">GPT</span>
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
                                messager.focus()
                            }
                        })
                `}</script>
            </body>
        </html>
    ))
    .listen(3000)
