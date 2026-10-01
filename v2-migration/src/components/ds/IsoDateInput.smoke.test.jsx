// @vitest-environment jsdom
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IsoDateInput from './IsoDateInput';
describe('ISO date editing', () => {
  it('shows ISO text and does not commit impossible dates', () => {
    const onChange = vi.fn();
    render(<IsoDateInput value="2024-02-01" min="2024-01-01" max="2024-12-31" aria-label="Start" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Start' });
    expect(input.value).toBe('2024-02-01');
    fireEvent.change(input, { target: { value: '2024-02-31' } });fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(input, { target: { value: '2024-02-29' } });fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ target: { value: '2024-02-29' } });
  });
  it('cancels a draft without changing the applied date', () => {
    const onChange = vi.fn();render(<IsoDateInput value="2024-03-04" aria-label="End" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'End' });fireEvent.change(input, { target: { value: 'bad' } });fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('2024-03-04');expect(onChange).not.toHaveBeenCalled();
  });
  it('allows clearing an optional date and gives readable unbounded validation', () => {
    const onChange = vi.fn();render(<IsoDateInput allowEmpty value="2024-03-04" aria-label="End" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'End' });
    fireEvent.change(input, { target: { value: 'bad' } });fireEvent.blur(input);
    expect(screen.getByRole('alert').textContent).not.toContain('undefined');
    fireEvent.change(input, { target: { value: '' } });fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ target: { value: '' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

});
