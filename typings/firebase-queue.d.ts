interface FirebaseQueue {
}

type FirebaseQueueCallback = (data: any, progress: any, resolve: any, reject: any) => void

interface FirebaseQueueStatic {
  new(ref: any, callback:FirebaseQueueCallback): FirebaseQueue;
  new(ref: any, options:any, callback:FirebaseQueueCallback): FirebaseQueue;
}

declare let FirebaseQueue: FirebaseQueueStatic;

declare module 'firebase-queue' {
  export = FirebaseQueue;
}
