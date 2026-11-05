import { IsIn } from 'class-validator';
import type { SetEggApprovalRequest } from '@shared/types';

export class SetEggApprovalDto implements SetEggApprovalRequest {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';
}
