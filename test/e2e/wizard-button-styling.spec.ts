import { browser } from "@wdio/globals";
import { expect } from "@wdio/globals";
import { TestUtils } from "./helpers/test-utils";

describe("Setup Wizard Button Styling", () => {
  beforeEach(async () => {
    console.log("🔧 Setting up wizard button styling test...");
    // Configure plugin with wizard reset
    await TestUtils.configurePlugin({
      targetFolder: "Meetings",
      folderOrganization: "flat",
      wizardCompleted: false // Force wizard to show
    });
    await TestUtils.closeAllModals();
    await browser.pause(1000);
  });

  describe("Template Settings Step (Step 6)", () => {
    it("should display button toggles horizontally with green active state", async () => {
      console.log("🧪 Testing Template Settings button layout...");
      
      // Navigate to step 6 (template-settings)
      await TestUtils.navigateToWizardStep(6);
      
      // Wait for step to render
      await browser.pause(1000);
      
      // Verify we're on the right step
      const stepTitle = await browser.execute(() => {
        const titleEl = document.querySelector('.granola-wizard-header h2');
        return titleEl?.textContent;
      });
      
      console.log(`Current step title: ${stepTitle}`);
      expect(stepTitle).toContain('Template');
      
      // Analyze button container layout
      const buttonLayout = await browser.execute(() => {
        const containers = [
          document.querySelector('.granola-button-toggle-group'),
          document.querySelector('.granola-button-toggle-group-inline'),
          // Also check for non-prefixed classes (current broken state)
          document.querySelector('.button-toggle-group'),
          document.querySelector('.button-toggle-group-inline')
        ].filter(Boolean);
        
        if (containers.length === 0) {
          return { error: 'No button toggle containers found' };
        }
        
        const container = containers[0] as HTMLElement;
        const buttons = container.querySelectorAll('.granola-button-toggle, .button-toggle');
        
        if (buttons.length === 0) {
          return { error: 'No toggle buttons found in container' };
        }
        
        const containerStyles = window.getComputedStyle(container);
        const buttonPositions = Array.from(buttons).map((btn, index) => {
          const rect = btn.getBoundingClientRect();
          return {
            index,
            text: btn.textContent?.trim(),
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          };
        });
        
        // Determine if buttons are arranged horizontally
        const isHorizontal = buttonPositions.length >= 2 && 
          Math.abs(buttonPositions[0].top - buttonPositions[1].top) < 10 && // Same row
          buttonPositions[0].left < buttonPositions[1].left; // Side by side
        
        return {
          containerDisplay: containerStyles.display,
          containerFlexDirection: containerStyles.flexDirection,
          containerGap: containerStyles.gap,
          buttonCount: buttons.length,
          buttonPositions,
          isHorizontal,
          containerClass: container.className
        };
      });
      
      console.log('Button Layout Analysis:', JSON.stringify(buttonLayout, null, 2));
      
      // Verify horizontal layout
      expect(buttonLayout.error).toBeUndefined();
      expect(buttonLayout.containerDisplay).toBe('flex');
      expect(buttonLayout.isHorizontal).toBe(true);
      expect(buttonLayout.buttonCount).toBeGreaterThanOrEqual(2);
      
      // Test button interaction and styling
      const buttonStyling = await browser.execute(() => {
        const buttons = document.querySelectorAll('.granola-button-toggle, .button-toggle');
        const results: any[] = [];
        
        buttons.forEach((button, index) => {
          // Get initial state
          const initialStyles = window.getComputedStyle(button);
          const initialState = {
            index,
            text: button.textContent?.trim(),
            hasActiveClass: button.classList.contains('active'),
            backgroundColor: initialStyles.backgroundColor,
            color: initialStyles.color,
            borderColor: initialStyles.borderColor
          };
          
          // Click the button to activate it
          (button as HTMLElement).click();
          
          // Get activated state
          const activatedStyles = window.getComputedStyle(button);
          const activatedState = {
            hasActiveClass: button.classList.contains('active'),
            backgroundColor: activatedStyles.backgroundColor,
            color: activatedStyles.color,
            borderColor: activatedStyles.borderColor
          };
          
          results.push({
            initial: initialState,
            activated: activatedState
          });
        });
        
        return results;
      });
      
      console.log('Button Styling Analysis:', JSON.stringify(buttonStyling, null, 2));
      
      // Verify active button styling (should be green: rgb(76, 175, 80) = #4caf50)
      const activeButton = buttonStyling.find(result => result.activated.hasActiveClass);
      expect(activeButton).toBeDefined();
      expect(activeButton.activated.backgroundColor).toBe('rgb(76, 175, 80)');
      expect(activeButton.activated.color).toBe('rgb(255, 255, 255)');
      
      // Take screenshot evidence
      await browser.saveScreenshot('./test-screenshots/wizard-step-5-buttons.png');
    });
  });

  describe("Sync Settings Step (Step 8)", () => {
    it("should display button toggles horizontally with green active state", async () => {
      console.log("🧪 Testing Sync Settings button layout...");
      
      // Navigate to step 8 (sync-settings)
      await TestUtils.navigateToWizardStep(8);
      
      // Wait for step to render
      await browser.pause(1000);
      
      // Verify we're on the right step
      const stepTitle = await browser.execute(() => {
        const titleEl = document.querySelector('.granola-wizard-header h2');
        return titleEl?.textContent;
      });
      
      console.log(`Current step title: ${stepTitle}`);
      expect(stepTitle).toContain('Sync');
      
      // Analyze button container layout
      const buttonLayout = await browser.execute(() => {
        const containers = [
          document.querySelector('.granola-button-toggle-group'),
          document.querySelector('.granola-button-toggle-group-inline'),
          // Also check for non-prefixed classes (current broken state)
          document.querySelector('.button-toggle-group'),
          document.querySelector('.button-toggle-group-inline')
        ].filter(Boolean);
        
        if (containers.length === 0) {
          return { error: 'No button toggle containers found' };
        }
        
        const container = containers[0] as HTMLElement;
        const buttons = container.querySelectorAll('.granola-button-toggle, .button-toggle');
        
        if (buttons.length === 0) {
          return { error: 'No toggle buttons found in container' };
        }
        
        const containerStyles = window.getComputedStyle(container);
        const buttonPositions = Array.from(buttons).map((btn, index) => {
          const rect = btn.getBoundingClientRect();
          return {
            index,
            text: btn.textContent?.trim(),
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          };
        });
        
        // Determine if buttons are arranged horizontally
        const isHorizontal = buttonPositions.length >= 2 && 
          Math.abs(buttonPositions[0].top - buttonPositions[1].top) < 10 && // Same row
          buttonPositions[0].left < buttonPositions[1].left; // Side by side
        
        return {
          containerDisplay: containerStyles.display,
          containerFlexDirection: containerStyles.flexDirection,
          containerGap: containerStyles.gap,
          buttonCount: buttons.length,
          buttonPositions,
          isHorizontal,
          containerClass: container.className
        };
      });
      
      console.log('Button Layout Analysis (Step 7):', JSON.stringify(buttonLayout, null, 2));
      
      // THIS IS WHERE WE EXPECT FAILURE - Step 7 should use wrong CSS class
      expect(buttonLayout.error).toBeUndefined();
      expect(buttonLayout.containerDisplay).toBe('flex');
      expect(buttonLayout.isHorizontal).toBe(true); // This should FAIL initially
      expect(buttonLayout.buttonCount).toBeGreaterThanOrEqual(2);
      
      // Test button interaction and styling
      const buttonStyling = await browser.execute(() => {
        const buttons = document.querySelectorAll('.granola-button-toggle, .button-toggle');
        const results: any[] = [];
        
        buttons.forEach((button, index) => {
          // Get initial state
          const initialStyles = window.getComputedStyle(button);
          const initialState = {
            index,
            text: button.textContent?.trim(),
            hasActiveClass: button.classList.contains('active'),
            backgroundColor: initialStyles.backgroundColor,
            color: initialStyles.color,
            borderColor: initialStyles.borderColor
          };
          
          // Click the button to activate it
          (button as HTMLElement).click();
          
          // Get activated state
          const activatedStyles = window.getComputedStyle(button);
          const activatedState = {
            hasActiveClass: button.classList.contains('active'),
            backgroundColor: activatedStyles.backgroundColor,
            color: activatedStyles.color,
            borderColor: activatedStyles.borderColor
          };
          
          results.push({
            initial: initialState,
            activated: activatedState
          });
        });
        
        return results;
      });
      
      console.log('Button Styling Analysis (Step 7):', JSON.stringify(buttonStyling, null, 2));
      
      // Verify active button styling (should be green: rgb(76, 175, 80) = #4caf50)
      const activeButton = buttonStyling.find(result => result.activated.hasActiveClass);
      expect(activeButton).toBeDefined();
      expect(activeButton.activated.backgroundColor).toBe('rgb(76, 175, 80)');
      expect(activeButton.activated.color).toBe('rgb(255, 255, 255)');
      
      // Take screenshot evidence
      await browser.saveScreenshot('./test-screenshots/wizard-step-7-buttons.png');
    });
  });

  describe("CSS Scoping Verification", () => {
    it("should properly scope button toggle styles to wizard only", async () => {
      console.log("🔍 Verifying CSS scoping...");
      
      // Navigate to a step with buttons
      await TestUtils.navigateToWizardStep(6);
      await browser.pause(1000);
      
      // Verify CSS scoping
      const scopingCheck = await browser.execute(() => {
        const allButtonToggles = document.querySelectorAll('.granola-button-toggle');
        const scopedToggles = document.querySelectorAll('.granola-setup-wizard .granola-button-toggle');
        
        // Check if any button toggles exist outside wizard
        const unscopedToggles = Array.from(allButtonToggles).filter(btn => 
          !btn.closest('.granola-setup-wizard')
        );
        
        return {
          allButtons: allButtonToggles.length,
          scopedButtons: scopedToggles.length,
          unscopedButtons: unscopedToggles.length,
          properlyScoped: unscopedToggles.length === 0
        };
      });
      
      console.log('CSS Scoping Check:', scopingCheck);
      
      expect(scopingCheck.properlyScoped).toBe(true);
      expect(scopingCheck.scopedButtons).toBeGreaterThan(0);
      expect(scopingCheck.unscopedButtons).toBe(0);
    });
  });

  afterEach(async () => {
    await TestUtils.closeAllModals();
  });
});