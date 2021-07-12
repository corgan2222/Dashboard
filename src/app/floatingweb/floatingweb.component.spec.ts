import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FloatingwebComponent } from './floatingweb.component';

describe('FloatingwebComponent', () => {
  let component: FloatingwebComponent;
  let fixture: ComponentFixture<FloatingwebComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ FloatingwebComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FloatingwebComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
