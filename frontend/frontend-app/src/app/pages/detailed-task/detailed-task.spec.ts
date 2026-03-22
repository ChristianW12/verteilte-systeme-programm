import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailedTask } from './detailed-task';

describe('DetailedTask', () => {
  let component: DetailedTask;
  let fixture: ComponentFixture<DetailedTask>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailedTask],
    }).compileComponents();

    fixture = TestBed.createComponent(DetailedTask);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


