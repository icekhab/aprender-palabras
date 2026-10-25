import { Module } from '@nestjs/common'
import { QuotaService } from './quota.service.js'

@Module({
  providers: [QuotaService],
  exports: [QuotaService],
})
export class QuotasModule {}
