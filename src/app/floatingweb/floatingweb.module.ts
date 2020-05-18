import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { FloatingwebRoutingModule } from './floatingweb-routing.module';
import { FloatingwebComponent } from './floatingweb.component';
import { AngularSplitModule } from 'angular-split';


@NgModule({
  declarations: [FloatingwebComponent],
  imports: [
    CommonModule,
    FloatingwebRoutingModule,
    AngularSplitModule.forRoot()

  ]
})
export class FloatingwebModule { }
