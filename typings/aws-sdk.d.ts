declare namespace Kinesis {
  interface PutRecordParams {
    Data: Buffer;
    PartitionKey: string;
    StreamName: string;
  }

  interface PutRecordResponse {
    ShardId: string;
    SequenceNumber: string;
  }

  interface CreateStreamParams {
    StreamName: string;
    ShardCount: number;
  }

  interface CreateStreamResponse {

  }

  interface DescribeStreamParams {
    StreamName: string;
    Limit?: number;
    ExclusiveStartShardId?: string;
  }

  interface Shard {
    ShardId: string;
    ParentShardId?: string;
    AdjacentParentShardId?: string;
    HashKeyRange: {
      StartingHashKey: string;
      EndingHashKey: string;
    };
    SequenceNumberRange: {
      StartingSequenceNumber: string;
      EndingSequenceNumber?: string;
    };
  }

  type ShardLevelMetrics = 'ALL'|'IncomingBytes'|'IncomingRecords'|
    'OutgoingBytes'|'OutgoingRecords'|'WriteProvisionedThroughputExceeded'|
    'ReadProvisionedThroughputExceeded'|'IteratorAgeMilliseconds';

  interface EnhancedMonitoring {
    ShardLevelMetrics: ShardLevelMetrics[];
  }

  interface DescribeStreamResponse {
    StreamDescription: {
      StreamName: string;
      StreamARN: string;
      StreamStatus: 'CREATING'|'DELETING'|'ACTIVE'|'UPDATING';
      Shards: Shard[];
      HasMoreShards: boolean;
      RetentionPeriodHours: number;
      EnhancedMonitoring: EnhancedMonitoring[];
    };
  }
}

declare module 'aws-sdk' {
  type Callback<T> = (err: any, data: T) => void;

  interface Response<T> {
    promise(): Promise<T>;
  }

  export class Kinesis {
    constructor(options?: any);

    putRecord(params: Kinesis.PutRecordParams,
              callback?: Callback<Kinesis.PutRecordResponse>
    ): Response<Kinesis.PutRecordResponse>;

    createStream(params: Kinesis.CreateStreamParams,
                 callback?: Callback<Kinesis.CreateStreamResponse>
    ): Response<Kinesis.CreateStreamResponse>;

    describeStream(params: Kinesis.DescribeStreamParams,
                   callback?: Callback<Kinesis.DescribeStreamResponse>
    ): Response<Kinesis.DescribeStreamResponse>;
  }
}