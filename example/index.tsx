import { Elysia, t } from "elysia";

import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { cors } from "@elysiajs/cors";

import { OpenAI } from "openai";
import { Stream } from "../src";

import { instruction } from "./instruction";

const openai = new OpenAI({ apiKey: Bun.env.OPENAI_API_KEY });

// Server Sent Event
new Stream((stream) => {
    const interval = setInterval(() => {
        stream.send("hello world");
    }, 500);

    setTimeout(() => {
        clearInterval(interval);
        stream.close();
    }, 3000);
});

const app = new Elysia()
    .use(cors())
    .use(html())
    .use(staticPlugin())
    .decorate("openai", new OpenAI({ apiKey: Bun.env.OPENAI_API_KEY }))
    .model(
        "openai.prompt",
        t.Array(
            t.Object({
                role: t.String(),
                content: t.String(),
            }),
        ),
    )
    .post(
        "/ai",
        ({ openai, body }) =>
            new Stream(
                openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    stream: true,
                    messages: instruction.concat(body as any),
                }),
                {
                    retry: 1000,
                },
            ),
        {
            body: "openai.prompt",
        },
    )
    // ? You can stream from fetch to proxy response
    .post(
        "/ai/proxy",
        ({ body }) =>
            new Stream(
                fetch("http://localhost:3000/ai", {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(body),
                }),
                {
                    event: "ai",
                },
            ),
        {
            body: "openai.prompt",
        },
    )
    .get("/", () => (
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
                    <section class="flex gap-2 rounded-lg border p-2.5">
                        <img
                            class="min-w-12 h-12 w-12 rounded-full object-cover object-center"
                            src="/public/aris-maid.png"
                            alt="Aris Maid"
                        />
                        <p class="mb-1 mt-2.5 w-full whitespace-pre-wrap break-words px-2 text-lg">
                            ...
                        </p>
                    </section>
                </template>

                <template id="user-message">
                    <section class="flex gap-2 rounded-lg bg-gray-100/75 p-2.5">
                        <img
                            class="min-w-12 h-12 w-12 rounded-full object-cover object-center"
                            src="/public/aris.jpg"
                            alt="Aris"
                        />
                        <p class="mb-1 mt-2.5 w-full whitespace-pre-wrap break-words px-2 text-lg" />
                    </section>
                </template>

                <main class="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-3 px-4">
                    <header class="sticky top-0 flex w-full border-b bg-white p-2">
                        <h1 class="text-2xl font-medium">
                            Aris
                            <span class="font-normal text-blue-500">GPT</span>
                        </h1>
                    </header>
                    <section
                        id="chat"
                        class="flex w-full flex-1 flex-col gap-3 py-4"
                    />
                    <form
                        id="form"
                        class="sticky bottom-4 flex w-full rounded-lg bg-gray-100 px-1"
                    >
                        <input
                            id="messager"
                            placeholder="Send a message"
                            class="w-full bg-transparent p-2.5 text-lg outline-none"
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
    .listen(3000);
