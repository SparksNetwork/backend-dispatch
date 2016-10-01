declare namespace Kinesis {
  interface PutRecordParams {
    Data: Buffer;
    PartitionKey:string;
    StreamName:string;
  }

  interface PutRecordResponse {
    ShardId:string;
    SequenceNumber:string;
  }
}

declare module 'aws-sdk' {
  type Callback<T> = (err:any, data:T) => void;

  interface Response<T> {
    promise():Promise<T>;
  }

  export class Kinesis {
    constructor(options?:any);
    putRecord(params:Kinesis.PutRecordParams, callback?:Callback<Kinesis.PutRecordResponse>):Response<Kinesis.PutRecordResponse>;
  }
}