import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ClearAssistantContainer } from '../components/AssistedClearContainer';

describe('AssistedClearContainer Tests', () => {
  it('should show default state upon render', () => {
    let reconcileValue = '123';
    const { getByTestId, queryByTestId } = render(
      <ClearAssistantContainer reconcileInputValue={reconcileValue} />
    );
    expect(getByTestId('assisted-clear-button')).toBeTruthy();
    expect(queryByTestId('assisted-clear-tooltip')).toBeNull();
    expect(queryByTestId('assisted-clear-modal')).toBeNull();
  });

  it('should show tooltip renders on hover', () => {
    let reconcileValue = '123';
    const { getByTestId, queryByTestId } = render(
      <ClearAssistantContainer reconcileInputValue={reconcileValue} />
    );
    expect(getByTestId('assisted-clear-button')).toBeTruthy();
    expect(queryByTestId('assisted-clear-tooltip')).toBeNull();

    fireEvent.mouseEnter(getByTestId('assisted-clear-button'));
    expect(getByTestId('assisted-clear-tooltip')).toBeTruthy();

    fireEvent.mouseLeave(getByTestId('assisted-clear-button'));
    expect(queryByTestId('assisted-clear-tooltip')).toBeNull();
  });

  it('should not show modal with invalid input', () => {
    let reconcileValue = '123.abc';
    const { getByTestId, queryByTestId } = render(
      <ClearAssistantContainer reconcileInputValue={reconcileValue} />
    );
    fireEvent.click(getByTestId('assisted-clear-button'));
    expect(queryByTestId('assisted-clear-modal')).toBeNull();
  });

  it('should not show modal with empty input', () => {
    let reconcileValue = '';
    const { getByTestId, queryByTestId } = render(
      <ClearAssistantContainer reconcileInputValue={reconcileValue} />
    );
    fireEvent.click(getByTestId('assisted-clear-button'));
    expect(queryByTestId('assisted-clear-modal')).toBeNull();
  });
});
