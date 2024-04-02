import { nanoid } from 'nanoid'

type MaybePromise<T> = T | Promise<T>

type Streamable =
    | Iterable<unknown>
    | AsyncIterable<unknown>
    | ReadableStream
    | Response
    | null

type StreamOption = {
    /**
     * A string identifying the type of event described.
     * 
     * If specified, an event will be dispatched on the browser
     * to the listener for the specified event name;
     *
     * The website source code should use addEventListener()
     * to listen for named events.
     *
     * The onmessage handler is called if no event name
     * is specified for a message.
     */
    event?: string
    /**
     * The reconnection time in milliseconds.
     *
     * If the connection to the server is lost,
     * the browser will wait for the specified time before
     * attempting to reconnect.
     */
    retry?: number
    /**
     * The format of the data sent throw the stream.
     * 
     * If set to true, the data will be directly sent without
     * any transformation.
     * 
     * By default all the data are sent with an id.
     */
    rowData?: false
} | {
    /**
     * The format of the data sent throw the stream.
     * 
     * If set to true, the data will be directly sent without
     * any transformation.
     * 
     * By default all the data are sent with an id.
     */
    rowData: true
}

const encoder = new TextEncoder()

export const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

const isIterable = (
    value: unknown
): value is Iterable<any> | AsyncIterable<any> => {
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

    private _retry?: number
    private _event?: string
    private _rowData?: boolean
    private label: string = ''
    private labelUint8Array = new Uint8Array()

    private composeLabel() {
        this.label = ''

        if (this._event) this.label += `event: ${this._event}\n`
        if (this._retry) this.label += `retry: ${this._retry}\n`

        if (this.label) this.labelUint8Array = encoder.encode(this.label)
    }

    get retry() {
        return this._retry
    }

    set retry(retry: number | undefined) {
        this._retry = retry
        this.composeLabel()
    }

    get event() {
        return this._event
    }

    set event(event: string | undefined) {
        this._event = event
        this.composeLabel()
    }

    static concatUintArray(a: Uint8Array, b: Uint8Array) {
        const arr = new Uint8Array(a.length + b.length)
        arr.set(a, 0)
        arr.set(b, a.length)

        return arr
    }

    constructor(
        callback?: ((stream: Stream<Data>) => void) | MaybePromise<Streamable>,
        streamOption: StreamOption = {}
    ) {
        if (!streamOption.rowData && streamOption.retry) 
            this._retry = streamOption.retry
        if (!streamOption.rowData && streamOption.event) 
            this._event = streamOption.event
        if (streamOption.rowData) 
            this._rowData = streamOption.rowData
        if (!streamOption.rowData && (streamOption.retry || streamOption.event)) 
            this.composeLabel()

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

        if (data instanceof Uint8Array) {
            this.controller.enqueue(
                this.label
                    ? Stream.concatUintArray(this.labelUint8Array, data)
                    : data
            )
        } else if (this._rowData) {
            this.controller.enqueue(
                encoder.encode(typeof data === 'object' ? JSON.stringify(data) : data.toString())
            )
        } else
            this.controller.enqueue(
                encoder.encode(
                    typeof data === 'string' && data.includes('id:')
                        ? data +
                              (this._event && !data.includes('event:')
                                  ? `\nevent: ${this._event}`
                                  : '') +
                              (this._retry && !data.includes('retry:')
                                  ? `\retry: ${this.retry}`
                                  : '')
                        : `id: ${nanoid()}\n${this.label}data: ${
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
