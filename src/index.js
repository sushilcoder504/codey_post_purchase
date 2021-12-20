import {
  extend,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Text,
  TextContainer,
  Separator,
  Tiles,
  TextBlock,
  Layout,
} from '@shopify/post-purchase-ui-extensions';

extend('Checkout::PostPurchase::ShouldRender', async ({storage}) => {
  const postPurchaseOffer = await fetch('https://sushil-store2.herokuapp.com/offer').then(
    (res) => res.json()
  );

  await storage.update(postPurchaseOffer);

  return {render: true};
});

extend(
  'Checkout::PostPurchase::Render',
  (root, {done, storage, calculateChangeset, applyChangeset, inputData}) => {
    const {
      variantId,
      productTitle,
      productImageURL,
      productDescription,
      discountedPrice,
      originalPrice,
    } = storage.initialData;

    const changes = [{type: 'add_variant', variantId, quantity: 1}];

    const calloutBannerComponent = root.createComponent(
      CalloutBanner,
      {title: "It's not too late to add this to your order."},
      [
        root.createComponent(
          Text,
          {size: 'medium'},
          `Add the ${productTitle} to your order and `
        ),
        root.createComponent(
          Text,
          {size: 'medium', emphasized: true},
          'save 15%.'
        ),
      ]
    );

    const priceHeaderComponent = root.createComponent(
      TextContainer,
      {alignment: 'leading', spacing: 'loose'},
      [
        root.createComponent(
          Text,
          {role: 'deletion', size: 'large'},
          formatCurrency(originalPrice)
        ),
        ' ',
        root.createComponent(
          Text,
          {emphasized: true, size: 'large', appearance: 'critical'},
          formatCurrency(discountedPrice)
        ),
      ]
    );

    const productDescriptionTextBlocks = productDescription.map((text) =>
      root.createComponent(TextBlock, {subdued: true}, text)
    );
    const productDescriptionComponent = root.createComponent(
      BlockStack,
      {spacing: 'xtight'},
      productDescriptionTextBlocks
    );

    const acceptButton = root.createComponent(Button, {
      onPress: acceptOffer,
      submit: true,
      disabled: true,
      loading: true,
    });
    const declineButton = root.createComponent(
      Button,
      {onPress: declineOffer, subdued: true},
      'Decline this offer'
    );
    const buttonsComponent = root.createComponent(BlockStack, {}, [
      acceptButton,
      declineButton,
    ]);

    const wrapperComponent = root.createComponent(BlockStack, {}, [
      root.createComponent(Heading, {}, productTitle),
      priceHeaderComponent,
      productDescriptionComponent,
      buttonsComponent,
    ]);

    // Get shipping costs and taxes and update the UI
    (async function updatePriceBreakdownUI() {
      // Request shopify to calculate shipping costs and taxes for the upsell
      const result = await calculateChangeset({changes});

      // Extract values from response
      const shipping =
        result.calculatedPurchase?.addedShippingLines[0]?.priceSet
          ?.presentmentMoney?.amount;
      const taxes =
        result.calculatedPurchase?.addedTaxLines[0]?.priceSet?.presentmentMoney
          ?.amount;
      const total =
        result.calculatedPurchase?.totalOutstandingSet.presentmentMoney.amount;

      // Now that we have the shipping costs and taxes, let's create the price breakdown UI components ...
      function createPriceBreakdownLine({label, amount, textSize = 'small'}) {
        return root.createComponent(Tiles, {}, [
          root.createComponent(TextBlock, {size: 'small'}, label),
          root.createComponent(
            TextContainer,
            {alignment: 'trailing'},
            root.createComponent(
              TextBlock,
              {emphasized: true, size: textSize},
              amount
            )
          ),
        ]);
      }

      const priceBreakdownComponent = root.createComponent(
        BlockStack,
        {spacing: 'tight'},
        [
          root.createComponent(Separator),
          createPriceBreakdownLine({
            label: 'Subtotal',
            amount: formatCurrency(discountedPrice),
          }),
          createPriceBreakdownLine({
            label: 'Shipping',
            amount: formatCurrency(shipping),
          }),
          createPriceBreakdownLine({
            label: 'Taxes',
            amount: formatCurrency(taxes),
          }),
          root.createComponent(Separator),
          createPriceBreakdownLine({
            label: 'Total',
            amount: formatCurrency(total),
            textSize: 'medium',
          }),
        ]
      );

      // And add the components to the UI
      wrapperComponent.insertChildBefore(
        priceBreakdownComponent,
        buttonsComponent
      );

      // Also, don't forget to enable the accept button
      acceptButton.updateProps({disabled: false, loading: false});
      acceptButton.appendChild(`Pay now · ${formatCurrency(total)}`);
    })();

    // Decline button click handler
    function declineOffer() {
      acceptButton.updateProps({disabled: true});
      declineButton.updateProps({disabled: true, loading: true});
      done();
    }

    // Accept button click handler
    function acceptOffer() {
      async function doAcceptOrder() {
        // Make a request to your app server to sign the changeset
        const token = await fetch('https://sushil-store2.herokuapp.com/sign-changeset', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            referenceId: inputData.initialPurchase.referenceId,
            changes: changes,
            token: inputData.token,
          }),
        })
          .then((response) => response.json())
          .then((response) => response.token);

          console.log("changed value");
        // Make a request to Shopify servers to apply the changeset
        await applyChangeset(token);
        done();

      }

      // First update the state of the buttons, then call the async function
      acceptButton.updateProps({disabled: true, loading: true});
      declineButton.updateProps({disabled: true});
      doAcceptOrder();
    }

    // Put all the components together and render the UI
    root.appendChild(
      root.createComponent(BlockStack, {spacing: 'loose'}, [
        calloutBannerComponent,
        root.createComponent(
          Layout,
          {
            media: [
              {viewportSize: 'small', sizes: [1, 0, 1], maxInlineSize: 0.9},
              {viewportSize: 'medium', sizes: [532, 0, 1], maxInlineSize: 420},
              {viewportSize: 'large', sizes: [560, 38, 340]},
            ],
          },
          [
            root.createComponent(Image, {
              source: productImageURL,
              description: 'Product photo',
            }),
            root.createComponent(BlockStack),
            wrapperComponent,
          ]
        ),
      ])
    );
  }
);

function formatCurrency(amount) {
  if (!amount || parseInt(amount, 10) === 0) {
    return 'Free';
  }
  return `$${amount}`;
}
