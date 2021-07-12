import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FloatingwebComponent } from './floatingweb.component';

describe('FloatingwebComponent', () => {
  let component: FloatingwebComponent;
  let fixture: ComponentFixture<FloatingwebComponent>;

  beforeEach(async(() => {
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
