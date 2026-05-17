import React from 'react';
import { createPortal } from 'react-dom';

const GRACEFUL_OVERLAY_CLASS = 'modal-overlay-graceful';
const GRACEFUL_PANEL_CLASS = 'modal-panel-graceful';

const withClassName = (
  element: React.ReactElement<{ className?: string }>,
  className: string
) => {
  const existingClassName = element.props.className ?? '';

  if (existingClassName.split(/\s+/).includes(className)) {
    return element;
  }

  return React.cloneElement(element, {
    className: `${className} ${existingClassName}`.trim(),
  });
};

const addPanelAnimation = (node: React.ReactNode): React.ReactNode => {
  const children = React.Children.toArray(node);
  let panelAnimated = false;

  return children.map((child) => {
    if (!React.isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
      return child;
    }

    if (!panelAnimated) {
      panelAnimated = true;
      return withClassName(child, GRACEFUL_PANEL_CLASS);
    }

    return child;
  });
};

const addGracefulModalClasses = (node: React.ReactNode): React.ReactNode => {
  const children = React.Children.toArray(node);

  return children.map((child) => {
    if (!React.isValidElement<{ className?: string; children?: React.ReactNode }>(child)) {
      return child;
    }

    const overlay = withClassName(child, GRACEFUL_OVERLAY_CLASS);

    if (!overlay.props.children) {
      return overlay;
    }

    return React.cloneElement(overlay, {
      children: addPanelAnimation(overlay.props.children),
    });
  });
};

/**
 * ModalPortal renders its children directly into document.body via React Portal.
 * This ensures modal overlays and backdrop-blur cover the ENTIRE viewport,
 * including the header and sidebar, regardless of parent overflow/z-index constraints.
 * It also applies the shared graceful modal entrance animation to the overlay
 * and first modal panel so all portal-based modals behave consistently.
 */
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(addGracefulModalClasses(children), document.body);
};

export default ModalPortal;
