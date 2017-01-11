import * as firebase from 'firebase';

export type Ref = firebase.database.Reference;

export interface Message {
  domain:string;
  action:string;
  uid:string;
  payload:any;
}

export interface QueueMessage extends Message {
  key:string;
}

export interface DispatchResponse {
  ok:boolean;
  error?:any;
}

export interface ResponseMessage {
  key:string;
  rejected:boolean;
  message?:string;
  timestamp:number;
}

export interface Dispatch {
  (message: QueueMessage): Promise<DispatchResponse>;
}

export interface Dispatcher {
  (streamName:string, options?:any): Promise<Dispatch>;
}
