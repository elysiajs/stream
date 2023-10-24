import { nanoid } from 'nanoid'

type MaybePromise<T> = T | Promise<T>

export const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

type Streamable =
    | Iterable<unknown>
    | AsyncIterable<unknown>
    | ReadableStream
    | Response
    | null

const encoder = new TextEncoder()

function isIterable(
    value: unknown
): value is Iterable<any> | AsyncIterable<any> {
    if (!value) return false

    return (
        // @ts-ignore
        typeof value[Symbol.asyncIterator] === 'function' ||
        // @ts-ignore
        typeof value[Symbol.iterator] === 'function'
    )
}

export class Stream<Data extends string | number | boolean | object> {
    private $passthrough = 'value'
    private controller: ReadableStreamController<any> | undefined
    stream: ReadableStream<Data>

    constructor(
        callback?: ((stream: Stream<Data>) => void) | MaybePromise<Streamable>
    ) {
        switch (typeof callback) {
            case 'function':
            case 'undefined':
                this.stream = new ReadableStream({
                    start: (controller) => {
                        this.controller = controller
                        ;(callback as Function)?.(this)
                    },
                    cancel: (controller: ReadableStreamDefaultController) => {
                        controller.close()
                    }
                })
                break

            default:
                this.stream = new ReadableStream({
                    start: async (controller) => {
                        this.controller = controller

                        try {
                            for await (const chunk of await (callback as
                                | Iterable<string>
                                | AsyncIterable<string>))
                                this.send(chunk)

                            controller.close()
                        } catch {
                            if (callback instanceof Promise)
                                callback = await callback

                            if (callback === null) return controller.close()

                            const isResponse = callback instanceof Response

                            if (
                                isResponse ||
                                callback instanceof ReadableStream
                            ) {
                                const reader = isResponse
                                    ? (callback as Response).body?.getReader()
                                    : (callback as ReadableStream).getReader()

                                if (!reader) return controller.close()

                                while (true) {
                                    const { done, value } = await reader.read()

                                    this.send(value)

                                    if (done) {
                                        controller.close()
                                        break
                                    }
                                }
                            }
                        }
                    }
                })
        }
    }

    send(data: string | number | boolean | object | Uint8Array) {
        if (!this.controller || data === '' || data === undefined) return

        if (data instanceof Uint8Array) this.controller.enqueue(data)
        else
            this.controller.enqueue(
                encoder.encode(
                    typeof data === 'string' && data.startsWith('id:')
                        ? data
                        : `id: ${nanoid()}\ndata: ${
                              typeof data === 'object'
                                  ? JSON.stringify(data)
                                  : data
                          }\n\n`
                )
            )
    }

    close() {
        this.controller?.close()
    }

    wait = wait

    get value() {
        return this.stream
    }
}

export default Stream
