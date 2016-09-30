import * as firebase from 'firebase';

declare type Ref = firebase.database.Reference;

declare interface QueueMessage {
  key:string
  domain:string
  action:string
  uid:string
  payload:any
}

declare interface AuthResponse {
  reject?:string
}

declare interface DispatchResponse {

}

declare interface ResponseMessage {
  key:string
  rejected:boolean
}