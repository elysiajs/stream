import { MaybePromise } from 'elysia'
import { nanoid } from 'nanoid'

export const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

export class Stream<Data extends string | number | boolean | object> {
    private $passthrough = 'value'
    private controller: ReadableStreamController<any> | undefined
    stream: ReadableStream<Data>

    constructor(
        callback?:
            | ((stream: Stream<Data>) => void)
            | MaybePromise<Iterable<Data> | AsyncIterable<Data>>
    ) {
        switch (typeof callback) {
            case 'function':
            case 'undefined':
                this.stream = new ReadableStream({
                    start: (controller) => {
                        this.controller = controller

                        callback?.(this)
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

                        for await (const chunk of await callback)
                            this.send(chunk)

                        controller.close()
                    }
                })
            // this.stream = new ReadableStream({
            //     type: 'direct',
            //     pull: async (controller) => {
            //         // this.controller = controller

            //         for await (const chunk of await callback) {
            //             controller.write(
            //                 (typeof chunk !== 'object'
            //                     ? JSON.stringify(chunk)
            //                     : chunk + '') as any
            //             )
            //         }
            //     }
            // })
        }
    }

    send(data: string | number | boolean | object) {
        this.controller?.enqueue(
            Buffer.from(
                `id: ${nanoid()}\ndata: ${
                    typeof data === 'object' ? JSON.stringify(data) : data
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
