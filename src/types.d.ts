import * as firebase from 'firebase';

declare type Ref = firebase.database.Reference;

declare interface Message {
  domain:string;
  action:string;
  uid:string;
  payload:any;
}

declare interface QueueMessage extends Message {
  key:string;
}

declare interface AuthResponse {
  reject?:string;
}

declare interface DispatchResponse {
  ok:boolean;
  error?:any;
}

declare interface ResponseMessage {
  key:string;
  rejected:boolean;
  message?:string;
  timestamp:number;
}

declare interface Dispatch {
  (message: QueueMessage): Promise<DispatchResponse>;
}

declare interface Dispatcher {
  (streamName:string, options?:any): Promise<Dispatch>;
}