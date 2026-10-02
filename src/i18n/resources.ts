export const resources = {
  uk: {
    translation: {
      appName: 'Dometra',
      demoMode: 'Демо режим',
      landlord: 'Орендодавець',
      tenant: 'Орендар',
      dashboard: 'Головна',
      properties: 'Об’єкти',
      payments: 'Платежі',
      settings: 'Налаштування',
      home: 'Моя оренда',
      readings: 'Показники',
      invoices: 'Рахунки',

      expected: 'Очікується',
      received: 'Отримано',
      outstanding: 'Борг',
      advance: 'Аванс',
      collectionRate: 'Збір',

      reminders: 'Нагадування',
      seeAll: 'Переглянути все',
      activeProperties: 'Активні об’єкти',
      addProperty: 'Додати об’єкт',

      occupied: 'Заселено',
      vacant: 'Вільно',
      available: 'Вільно',
      active: 'Активна',
      pending: 'Очікується',
      checkoutRequired: 'Потрібне виселення',
      invitationPending: 'Запрошення очікує',

      rent: 'Оренда',
      utilities: 'Комунальні',
      meters: 'Лічильники',
      metersAndServices: 'Лічильники та послуги',
      tenantLabel: 'Орендар',

      addMeter: 'Додати лічильник',
      generateInvoice: 'Згенерувати рахунок',

      meterReading: 'Показники лічильника',
      takePhoto: 'Зробити фото',
      retakePhoto: 'Перезняти',
      currentReading: 'Поточний показник',
      previousReading: 'Попередній',
      previousValue: 'Попереднє значення',
      consumption: 'Споживання',
      saveReading: 'Зберегти показник',

      cameraPermission: 'Потрібен доступ до камери',
      allowCamera: 'Дозволити камеру',

      invoice: 'Рахунок',
      due: 'До сплати',
      status: 'Статус',
      total: 'Разом',

      addPayment: 'Додати платіж',
      amount: 'Сума',
      currency: 'Валюта',
      method: 'Метод',
      note: 'Примітка',

      save: 'Зберегти',
      saving: 'Збереження...',
      saved: 'Збережено',
      cancel: 'Скасувати',

      language: 'Мова',
      notifications: 'Нагадування та push',
      roleMode: 'Режим застосунку',
      logout: 'Вийти',
      profile: 'Профіль',
      region: 'Регіон',
      displayCurrency: 'Валюта відображення',

      login: 'Увійти',
      register: 'Реєстрація',
      email: 'Email',
      password: 'Пароль',

      continueDemo: 'Продовжити демо',
      authHint:
        'Без Supabase можна увійти в демо та одразу тестувати весь UX.',

      noData: 'Немає даних',

      name: 'Назва',
      address: 'Адреса',
      city: 'Місто',
      area: 'Площа, м²',
      monthlyRent: 'Місячна оренда',
      create: 'Створити',

      electricity: 'Електроенергія',
      water: 'Вода',
      gas: 'Газ',
      dualTariff: 'Двотарифний T1/T2',
      singleTariff: 'Однотарифний',

      nextPayment: 'Наступна оплата',
      submitReadings: 'Передати показники',
      latestInvoice: 'Останній рахунок',
      switchMode: 'Перемкнути режим',

      resetDemo: 'Скинути демо дані',

      supabaseConnected: 'Supabase підключено',
      supabaseNotConnected: 'Supabase не підключено',

      pushTest: 'Тестове нагадування',

      paymentSaved: 'Платіж збережено',
      invoiceCreated: 'Рахунок створено',
      readingSaved: 'Показник збережено',

      push: 'Push-сповіщення',

      notificationDescription:
        'Оренда, показники лічильників і нагадування про прострочення',

      notificationScheduled:
        'Тестове сповіщення буде показано через 3 секунди.',

      notificationPermissionDenied:
        'Доступ до сповіщень не надано.',

      account: 'Обліковий запис',
      signedInWithSupabase:
        'Вхід виконано через Supabase',

      selectLanguage: 'Оберіть мову',
      change: 'Змінити',

      languageChangeFailed:
        'Не вдалося змінити мову.',

      tenantHomeTitle: 'Моя оренда',
      rentalApartments:
        'Ваші орендовані квартири',

      loadingApartments:
        'Завантаження квартир...',

      noActiveTenancy:
        'Немає активної оренди',

      noActiveTenancyDescription:
        'Після прийняття запрошення квартира з’явиться тут.',

      paymentDue: 'День оплати',

      dayNumber:
        '{{day}} число',

      started: 'Початок',

      endDate:
        'Дата завершення',

      openEnded:
        'Без кінцевої дати',

      securityDeposit:
        'Застава',

      submittedProgress:
        '{{submitted}}/{{total}} передано',

      noMetersOrServices:
        'Лічильники або послуги ще не налаштовані.',

      meter: 'Лічильник',
      fixed: 'Фіксована',
      variable: 'Змінна',
      perMonth: 'на місяць',

      lastValue:
        'Останнє значення: {{value}} {{currency}}',

      lastReadings:
        'Останні показники',

      openReadings:
        'Відкрити показники',

      meterStatusSubmitted:
        'Передано',

      meterStatusNeedValues:
        'Потрібно передати',

      sendBeforeFifth:
        'Передайте до 5-го числа',

      readingsSubtitle:
        'Передавайте показники комунальних лічильників',

      loadingMeters:
        'Завантаження лічильників...',

      readingsAvailableAfterJoin:
        'Показники стануть доступними після приєднання до квартири.',

      checkoutRegularReadingsDisabled:
        'Ця оренда очікує завершення. Звичайні щомісячні показники вимкнені.',

      noUtilityMeters:
        'Для цієї квартири не налаштовано комунальні лічильники.',

      lastReading:
        'Останній показник',

      lastSubmitted:
        'Остання передача: {{date}}',

      lastSubmittedLabel:
        'Остання передача',

      noReadingsYet:
        'Показників ще немає.',

      addReading:
        'Додати показник',

      updateReading:
        'Оновити показник',

      tariffsCount:
        '{{count}} тарифи',

      tariffsCount_one:
        '{{count}} тариф',

      tariffsCount_few:
        '{{count}} тарифи',

      tariffsCount_many:
        '{{count}} тарифів',

      meterReadingLoading:
        'Завантаження лічильника...',

      meterNotFound:
        'Лічильник не знайдено',

      meterUnavailable:
        'Цей лічильник недоступний для поточного облікового запису.',

      fixedMonthlyService:
        'Фіксована щомісячна послуга',

      fixedAmount:
        'Фіксована сума',

      noMeterReadingRequired:
        'Для цієї послуги не потрібно передавати показники.',

      variableService:
        'Змінна послуга',

      landlordManagedService:
        'Послуга керується орендодавцем',

      landlordManagedServiceDescription:
        'Змінні суми цієї послуги наразі вводить орендодавець.',

      variableMonthlyService:
        'Змінна щомісячна послуга',

      valueSaved:
        'Значення збережено.',

      unableToSave:
        'Не вдалося зберегти',

      unableToTakePhoto:
        'Не вдалося зробити фото.',

      unableToSelectPhoto:
        'Не вдалося вибрати фото.',

      enterValidValueForRegister:
        'Введіть коректне значення для {{register}}.',

      readingCannotBeLower:
        '{{register}} не може бути меншим за останній коректний показник.',

      addNewPhotoForRegister:
        'Додайте нове фото для {{register}}.',

      readingSavedTitle:
        'Показник збережено',

      tenantReadingSavedMessage:
        'Ваші показники успішно передано.',

      landlordReadingSavedMessage:
        'Нові показники збережено.',

      unableToSaveReading:
        'Не вдалося зберегти показник',

      cameraAccessDescription:
        'Dometra потрібен доступ до камери, щоб сфотографувати лічильник.',

      gallery:
        'Галерея',

      addNewMeterPhoto:
        'Додайте нове фото лічильника',

      currentReadingPlaceholder:
        'Введіть показник',

      sendMeterValuesBeforeFifth:
        'Передайте показники та свіжі фото до 5-го числа місяця.',

      never:
        'Ніколи',
    },
  },

  en: {
    translation: {
      appName: 'Dometra',
      demoMode: 'Demo mode',
      landlord: 'Landlord',
      tenant: 'Tenant',
      dashboard: 'Dashboard',
      properties: 'Properties',
      payments: 'Payments',
      settings: 'Settings',
      home: 'My rental',
      readings: 'Readings',
      invoices: 'Invoices',

      expected: 'Expected',
      received: 'Received',
      outstanding: 'Outstanding',
      advance: 'Advance',
      collectionRate: 'Collection',

      reminders: 'Reminders',
      seeAll: 'See all',
      activeProperties: 'Active properties',
      addProperty: 'Add property',

      occupied: 'Occupied',
      vacant: 'Vacant',
      available: 'Available',
      active: 'Active',
      pending: 'Pending',
      checkoutRequired: 'Checkout required',
      invitationPending: 'Invitation pending',

      rent: 'Rent',
      utilities: 'Utilities',
      meters: 'Meters',
      metersAndServices: 'Meters & services',
      tenantLabel: 'Tenant',

      addMeter: 'Add meter',
      generateInvoice: 'Generate invoice',

      meterReading: 'Meter reading',
      takePhoto: 'Take photo',
      retakePhoto: 'Retake photo',
      currentReading: 'Current reading',
      previousReading: 'Previous',
      previousValue: 'Previous value',
      consumption: 'Consumption',
      saveReading: 'Save reading',

      cameraPermission:
        'Camera permission is required',

      allowCamera:
        'Allow camera',

      invoice: 'Invoice',
      due: 'Due',
      status: 'Status',
      total: 'Total',

      addPayment: 'Add payment',
      amount: 'Amount',
      currency: 'Currency',
      method: 'Method',
      note: 'Note',

      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved',
      cancel: 'Cancel',

      language: 'Language',
      notifications: 'Notifications',
      roleMode: 'App mode',
      logout: 'Log out',
      profile: 'Profile',
      region: 'Region',
      displayCurrency: 'Display currency',

      login: 'Sign in',
      register: 'Register',
      email: 'Email',
      password: 'Password',

      continueDemo: 'Continue demo',

      authHint:
        'Without Supabase you can enter demo mode and test the complete UX immediately.',

      noData: 'No data',

      name: 'Name',
      address: 'Address',
      city: 'City',
      area: 'Area, m²',
      monthlyRent: 'Monthly rent',
      create: 'Create',

      electricity: 'Electricity',
      water: 'Water',
      gas: 'Gas',
      dualTariff: 'Dual tariff T1/T2',
      singleTariff: 'Single tariff',

      nextPayment: 'Next payment',
      submitReadings: 'Submit readings',
      latestInvoice: 'Latest invoice',
      switchMode: 'Switch mode',

      resetDemo: 'Reset demo data',

      supabaseConnected:
        'Supabase connected',

      supabaseNotConnected:
        'Supabase not connected',

      pushTest: 'Test reminder',

      paymentSaved: 'Payment saved',
      invoiceCreated: 'Invoice created',
      readingSaved: 'Reading saved',

      push:
        'Push notifications',

      notificationDescription:
        'Rent, meter readings and overdue reminders',

      notificationScheduled:
        'A test notification will appear in 3 seconds.',

      notificationPermissionDenied:
        'Notification permission was denied.',

      account:
        'Account',

      signedInWithSupabase:
        'Signed in with Supabase',

      selectLanguage:
        'Select language',

      change:
        'Change',

      languageChangeFailed:
        'Unable to change language.',

      tenantHomeTitle:
        'My rental',

      rentalApartments:
        'Your rental apartments',

      loadingApartments:
        'Loading apartments...',

      noActiveTenancy:
        'No active tenancy',

      noActiveTenancyDescription:
        'When you accept an apartment invitation, the rental will appear here.',

      paymentDue:
        'Payment due',

      dayNumber:
        'Day {{day}}',

      started:
        'Started',

      endDate:
        'End date',

      openEnded:
        'Open-ended',

      securityDeposit:
        'Security deposit',

      submittedProgress:
        '{{submitted}}/{{total}} submitted',

      noMetersOrServices:
        'No meters or services have been configured yet.',

      meter:
        'Meter',

      fixed:
        'Fixed',

      variable:
        'Variable',

      perMonth:
        'per month',

      lastValue:
        'Last value: {{value}} {{currency}}',

      lastReadings:
        'Last readings',

      openReadings:
        'Open readings',

      meterStatusSubmitted:
        'Submitted',

      meterStatusNeedValues:
        'Need to send values',

      sendBeforeFifth:
        'Submit before the 5th',

      readingsSubtitle:
        'Submit utility meter values',

      loadingMeters:
        'Loading meters...',

      readingsAvailableAfterJoin:
        'Meter readings become available after you join an apartment.',

      checkoutRegularReadingsDisabled:
        'This rental is waiting for checkout. Regular monthly readings are disabled.',

      noUtilityMeters:
        'No utility meters are configured for this apartment.',

      lastReading:
        'Last reading',

      lastSubmitted:
        'Last submitted: {{date}}',

      lastSubmittedLabel:
        'Last submitted',

      noReadingsYet:
        'No readings yet.',

      addReading:
        'Add reading',

      updateReading:
        'Update reading',

      tariffsCount:
        '{{count}} tariffs',

      tariffsCount_one:
        '{{count}} tariff',

      tariffsCount_other:
        '{{count}} tariffs',

      meterReadingLoading:
        'Loading meter...',

      meterNotFound:
        'Meter not found',

      meterUnavailable:
        'This meter is not available for the current account.',

      fixedMonthlyService:
        'Fixed monthly service',

      fixedAmount:
        'Fixed amount',

      noMeterReadingRequired:
        'No meter reading is required for this service.',

      variableService:
        'Variable service',

      landlordManagedService:
        'Landlord-managed service',

      landlordManagedServiceDescription:
        'Variable service charges are currently entered by the landlord.',

      variableMonthlyService:
        'Variable monthly service',

      valueSaved:
        'The value has been saved.',

      unableToSave:
        'Unable to save',

      unableToTakePhoto:
        'Unable to take photo.',

      unableToSelectPhoto:
        'Unable to select photo.',

      enterValidValueForRegister:
        'Enter a valid value for {{register}}.',

      readingCannotBeLower:
        '{{register}} cannot be lower than the last valid reading.',

      addNewPhotoForRegister:
        'Add a new photo for {{register}}.',

      readingSavedTitle:
        'Reading saved',

      tenantReadingSavedMessage:
        'Your meter reading has been sent successfully.',

      landlordReadingSavedMessage:
        'The new meter reading has been saved.',

      unableToSaveReading:
        'Unable to save reading',

      cameraAccessDescription:
        'Dometra needs camera access to photograph the meter.',

      gallery:
        'Gallery',

      addNewMeterPhoto:
        'Add a new meter photo',

      currentReadingPlaceholder:
        'Enter reading',

      sendMeterValuesBeforeFifth:
        'Submit meter values and fresh photos before the 5th of the month.',

      never:
        'Never',
    },
  },

  de: {
    translation: {
      appName: 'Dometra',
      demoMode: 'Demo-Modus',
      landlord: 'Vermieter',
      tenant: 'Mieter',
      dashboard: 'Übersicht',
      properties: 'Objekte',
      payments: 'Zahlungen',
      settings: 'Einstellungen',
      home: 'Meine Miete',
      readings: 'Zählerstände',
      invoices: 'Rechnungen',

      expected: 'Erwartet',
      received: 'Erhalten',
      outstanding: 'Offen',
      advance: 'Vorauszahlung',
      collectionRate: 'Quote',

      reminders: 'Erinnerungen',
      seeAll: 'Alle anzeigen',
      activeProperties: 'Aktive Objekte',
      addProperty: 'Objekt hinzufügen',

      occupied: 'Vermietet',
      vacant: 'Frei',
      available: 'Verfügbar',
      active: 'Aktiv',
      pending: 'Ausstehend',
      checkoutRequired: 'Auszug erforderlich',
      invitationPending: 'Einladung ausstehend',

      rent: 'Miete',
      utilities: 'Nebenkosten',
      meters: 'Zähler',
      metersAndServices: 'Zähler & Leistungen',
      tenantLabel: 'Mieter',

      addMeter: 'Zähler hinzufügen',
      generateInvoice: 'Rechnung erstellen',

      meterReading: 'Zählerstand',
      takePhoto: 'Foto aufnehmen',
      retakePhoto: 'Neu aufnehmen',
      currentReading: 'Aktueller Stand',
      previousReading: 'Vorheriger Stand',
      previousValue: 'Vorheriger Wert',
      consumption: 'Verbrauch',
      saveReading: 'Stand speichern',

      cameraPermission:
        'Kamerazugriff erforderlich',

      allowCamera:
        'Kamera erlauben',

      invoice: 'Rechnung',
      due: 'Fällig',
      status: 'Status',
      total: 'Gesamt',

      addPayment: 'Zahlung hinzufügen',
      amount: 'Betrag',
      currency: 'Währung',
      method: 'Methode',
      note: 'Notiz',

      save: 'Speichern',
      saving: 'Speichern...',
      saved: 'Gespeichert',
      cancel: 'Abbrechen',

      language: 'Sprache',
      notifications: 'Benachrichtigungen',
      roleMode: 'App-Modus',
      logout: 'Abmelden',
      profile: 'Profil',
      region: 'Region',
      displayCurrency: 'Anzeigewährung',

      login: 'Anmelden',
      register: 'Registrieren',
      email: 'E-Mail',
      password: 'Passwort',

      continueDemo: 'Demo starten',

      authHint:
        'Ohne Supabase kannst du den Demo-Modus starten und den gesamten UX sofort testen.',

      noData: 'Keine Daten',

      name: 'Name',
      address: 'Adresse',
      city: 'Stadt',
      area: 'Fläche, m²',
      monthlyRent: 'Monatsmiete',
      create: 'Erstellen',

      electricity: 'Strom',
      water: 'Wasser',
      gas: 'Gas',
      dualTariff: 'Doppeltarif T1/T2',
      singleTariff: 'Einzeltarif',

      nextPayment: 'Nächste Zahlung',
      submitReadings: 'Zählerstände senden',
      latestInvoice: 'Letzte Rechnung',
      switchMode: 'Modus wechseln',

      resetDemo: 'Demo-Daten zurücksetzen',

      supabaseConnected: 'Supabase verbunden',
      supabaseNotConnected: 'Supabase nicht verbunden',

      pushTest: 'Test-Erinnerung',

      paymentSaved: 'Zahlung gespeichert',
      invoiceCreated: 'Rechnung erstellt',
      readingSaved: 'Zählerstand gespeichert',

      push:
        'Push-Benachrichtigungen',

      notificationDescription:
        'Miete, Zählerstände und Erinnerungen bei Überfälligkeit',

      notificationScheduled:
        'Eine Testbenachrichtigung erscheint in 3 Sekunden.',

      notificationPermissionDenied:
        'Benachrichtigungsberechtigung wurde verweigert.',

      account:
        'Konto',

      signedInWithSupabase:
        'Mit Supabase angemeldet',

      selectLanguage:
        'Sprache auswählen',

      change:
        'Ändern',

      languageChangeFailed:
        'Sprache konnte nicht geändert werden.',

      tenantHomeTitle:
        'Meine Miete',

      rentalApartments:
        'Ihre Mietwohnungen',

      loadingApartments:
        'Wohnungen werden geladen...',

      noActiveTenancy:
        'Kein aktives Mietverhältnis',

      noActiveTenancyDescription:
        'Nach Annahme einer Wohnungseinladung erscheint das Mietverhältnis hier.',

      paymentDue:
        'Zahlung fällig',

      dayNumber:
        'Tag {{day}}',

      started:
        'Beginn',

      endDate:
        'Enddatum',

      openEnded:
        'Unbefristet',

      securityDeposit:
        'Kaution',

      submittedProgress:
        '{{submitted}}/{{total}} übermittelt',

      noMetersOrServices:
        'Noch keine Zähler oder Leistungen konfiguriert.',

      meter:
        'Zähler',

      fixed:
        'Fest',

      variable:
        'Variabel',

      perMonth:
        'pro Monat',

      lastValue:
        'Letzter Wert: {{value}} {{currency}}',

      lastReadings:
        'Letzte Zählerstände',

      openReadings:
        'Zählerstände öffnen',

      meterStatusSubmitted:
        'Übermittelt',

      meterStatusNeedValues:
        'Werte erforderlich',

      sendBeforeFifth:
        'Bis zum 5. übermitteln',

      readingsSubtitle:
        'Zählerstände für Nebenkosten übermitteln',

      loadingMeters:
        'Zähler werden geladen...',

      readingsAvailableAfterJoin:
        'Zählerstände werden verfügbar, nachdem Sie einer Wohnung beigetreten sind.',

      checkoutRegularReadingsDisabled:
        'Dieses Mietverhältnis wartet auf den Auszug. Reguläre Monatswerte sind deaktiviert.',

      noUtilityMeters:
        'Für diese Wohnung sind keine Verbrauchszähler konfiguriert.',

      lastReading:
        'Letzter Zählerstand',

      lastSubmitted:
        'Zuletzt übermittelt: {{date}}',

      lastSubmittedLabel:
        'Zuletzt übermittelt',

      noReadingsYet:
        'Noch keine Zählerstände.',

      addReading:
        'Zählerstand hinzufügen',

      updateReading:
        'Zählerstand aktualisieren',

      tariffsCount:
        '{{count}} Tarife',

      tariffsCount_one:
        '{{count}} Tarif',

      tariffsCount_other:
        '{{count}} Tarife',

      meterReadingLoading:
        'Zähler wird geladen...',

      meterNotFound:
        'Zähler nicht gefunden',

      meterUnavailable:
        'Dieser Zähler ist für das aktuelle Konto nicht verfügbar.',

      fixedMonthlyService:
        'Feste monatliche Leistung',

      fixedAmount:
        'Fester Betrag',

      noMeterReadingRequired:
        'Für diese Leistung ist kein Zählerstand erforderlich.',

      variableService:
        'Variable Leistung',

      landlordManagedService:
        'Vom Vermieter verwaltete Leistung',

      landlordManagedServiceDescription:
        'Variable Beträge für diese Leistung werden derzeit vom Vermieter eingetragen.',

      variableMonthlyService:
        'Variable monatliche Leistung',

      valueSaved:
        'Der Wert wurde gespeichert.',

      unableToSave:
        'Speichern nicht möglich',

      unableToTakePhoto:
        'Foto konnte nicht aufgenommen werden.',

      unableToSelectPhoto:
        'Foto konnte nicht ausgewählt werden.',

      enterValidValueForRegister:
        'Geben Sie einen gültigen Wert für {{register}} ein.',

      readingCannotBeLower:
        '{{register}} darf nicht niedriger als der letzte gültige Zählerstand sein.',

      addNewPhotoForRegister:
        'Fügen Sie ein neues Foto für {{register}} hinzu.',

      readingSavedTitle:
        'Zählerstand gespeichert',

      tenantReadingSavedMessage:
        'Ihr Zählerstand wurde erfolgreich übermittelt.',

      landlordReadingSavedMessage:
        'Der neue Zählerstand wurde gespeichert.',

      unableToSaveReading:
        'Zählerstand konnte nicht gespeichert werden',

      cameraAccessDescription:
        'Dometra benötigt Kamerazugriff, um den Zähler zu fotografieren.',

      gallery:
        'Galerie',

      addNewMeterPhoto:
        'Neues Zählerfoto hinzufügen',

      currentReadingPlaceholder:
        'Zählerstand eingeben',

      sendMeterValuesBeforeFifth:
        'Übermitteln Sie Zählerstände und aktuelle Fotos vor dem 5. des Monats.',

      never:
        'Nie',
    },
  },

  ru: {
    translation: {
      appName: 'Dometra',
      demoMode: 'Демо режим',
      landlord: 'Арендодатель',
      tenant: 'Арендатор',
      dashboard: 'Главная',
      properties: 'Объекты',
      payments: 'Платежи',
      settings: 'Настройки',
      home: 'Моя аренда',
      readings: 'Показания',
      invoices: 'Счета',

      expected: 'Ожидается',
      received: 'Получено',
      outstanding: 'Долг',
      advance: 'Аванс',
      collectionRate: 'Сбор',

      reminders: 'Напоминания',
      seeAll: 'Показать все',
      activeProperties: 'Активные объекты',
      addProperty: 'Добавить объект',

      occupied: 'Заселено',
      vacant: 'Свободно',
      available: 'Свободно',
      active: 'Активна',
      pending: 'Ожидается',
      checkoutRequired: 'Требуется выезд',
      invitationPending: 'Приглашение ожидает',

      rent: 'Аренда',
      utilities: 'Коммунальные',
      meters: 'Счётчики',
      metersAndServices: 'Счётчики и услуги',
      tenantLabel: 'Арендатор',

      addMeter: 'Добавить счётчик',
      generateInvoice: 'Создать счёт',

      meterReading: 'Показания счётчика',
      takePhoto: 'Сделать фото',
      retakePhoto: 'Переснять',
      currentReading: 'Текущее показание',
      previousReading: 'Предыдущее',
      previousValue: 'Предыдущее значение',
      consumption: 'Расход',
      saveReading: 'Сохранить показание',

      cameraPermission:
        'Нужен доступ к камере',

      allowCamera:
        'Разрешить камеру',

      invoice: 'Счёт',
      due: 'К оплате',
      status: 'Статус',
      total: 'Итого',

      addPayment: 'Добавить платёж',
      amount: 'Сумма',
      currency: 'Валюта',
      method: 'Метод',
      note: 'Примечание',

      save: 'Сохранить',
      saving: 'Сохранение...',
      saved: 'Сохранено',
      cancel: 'Отмена',

      language: 'Язык',
      notifications: 'Уведомления',
      roleMode: 'Режим приложения',
      logout: 'Выйти',
      profile: 'Профиль',
      region: 'Регион',
      displayCurrency: 'Валюта отображения',

      login: 'Войти',
      register: 'Регистрация',
      email: 'Email',
      password: 'Пароль',

      continueDemo: 'Продолжить демо',

      authHint:
        'Без Supabase можно войти в демо и сразу протестировать весь UX.',

      noData: 'Нет данных',

      name: 'Название',
      address: 'Адрес',
      city: 'Город',
      area: 'Площадь, м²',
      monthlyRent: 'Месячная аренда',
      create: 'Создать',

      electricity: 'Электроэнергия',
      water: 'Вода',
      gas: 'Газ',
      dualTariff: 'Двухтарифный T1/T2',
      singleTariff: 'Однотарифный',

      nextPayment: 'Следующая оплата',
      submitReadings: 'Передать показания',
      latestInvoice: 'Последний счёт',
      switchMode: 'Переключить режим',

      resetDemo: 'Сбросить демо данные',

      supabaseConnected: 'Supabase подключён',
      supabaseNotConnected: 'Supabase не подключён',

      pushTest: 'Тестовое напоминание',

      paymentSaved: 'Платёж сохранён',
      invoiceCreated: 'Счёт создан',
      readingSaved: 'Показание сохранено',

      push:
        'Push-уведомления',

      notificationDescription:
        'Аренда, показания счётчиков и напоминания о просрочке',

      notificationScheduled:
        'Тестовое уведомление появится через 3 секунды.',

      notificationPermissionDenied:
        'Доступ к уведомлениям не предоставлен.',

      account:
        'Учётная запись',

      signedInWithSupabase:
        'Вход выполнен через Supabase',

      selectLanguage:
        'Выберите язык',

      change:
        'Изменить',

      languageChangeFailed:
        'Не удалось изменить язык.',

      tenantHomeTitle:
        'Моя аренда',

      rentalApartments:
        'Ваши арендованные квартиры',

      loadingApartments:
        'Загрузка квартир...',

      noActiveTenancy:
        'Нет активной аренды',

      noActiveTenancyDescription:
        'После принятия приглашения квартира появится здесь.',

      paymentDue:
        'День оплаты',

      dayNumber:
        '{{day}} число',

      started:
        'Начало',

      endDate:
        'Дата окончания',

      openEnded:
        'Без конечной даты',

      securityDeposit:
        'Залог',

      submittedProgress:
        '{{submitted}}/{{total}} передано',

      noMetersOrServices:
        'Счётчики или услуги ещё не настроены.',

      meter:
        'Счётчик',

      fixed:
        'Фиксированная',

      variable:
        'Переменная',

      perMonth:
        'в месяц',

      lastValue:
        'Последнее значение: {{value}} {{currency}}',

      lastReadings:
        'Последние показания',

      openReadings:
        'Открыть показания',

      meterStatusSubmitted:
        'Передано',

      meterStatusNeedValues:
        'Нужно передать',

      sendBeforeFifth:
        'Передайте до 5-го числа',

      readingsSubtitle:
        'Передавайте показания коммунальных счётчиков',

      loadingMeters:
        'Загрузка счётчиков...',

      readingsAvailableAfterJoin:
        'Показания станут доступны после присоединения к квартире.',

      checkoutRegularReadingsDisabled:
        'Эта аренда ожидает завершения. Обычные ежемесячные показания отключены.',

      noUtilityMeters:
        'Для этой квартиры не настроены коммунальные счётчики.',

      lastReading:
        'Последнее показание',

      lastSubmitted:
        'Последняя передача: {{date}}',

      lastSubmittedLabel:
        'Последняя передача',

      noReadingsYet:
        'Показаний ещё нет.',

      addReading:
        'Добавить показание',

      updateReading:
        'Обновить показание',

      tariffsCount:
        '{{count}} тарифа',

      tariffsCount_one:
        '{{count}} тариф',

      tariffsCount_few:
        '{{count}} тарифа',

      tariffsCount_many:
        '{{count}} тарифов',

      meterReadingLoading:
        'Загрузка счётчика...',

      meterNotFound:
        'Счётчик не найден',

      meterUnavailable:
        'Этот счётчик недоступен для текущей учётной записи.',

      fixedMonthlyService:
        'Фиксированная ежемесячная услуга',

      fixedAmount:
        'Фиксированная сумма',

      noMeterReadingRequired:
        'Для этой услуги не нужно передавать показания.',

      variableService:
        'Переменная услуга',

      landlordManagedService:
        'Услуга управляется арендодателем',

      landlordManagedServiceDescription:
        'Переменные суммы этой услуги сейчас вводит арендодатель.',

      variableMonthlyService:
        'Переменная ежемесячная услуга',

      valueSaved:
        'Значение сохранено.',

      unableToSave:
        'Не удалось сохранить',

      unableToTakePhoto:
        'Не удалось сделать фото.',

      unableToSelectPhoto:
        'Не удалось выбрать фото.',

      enterValidValueForRegister:
        'Введите корректное значение для {{register}}.',

      readingCannotBeLower:
        '{{register}} не может быть меньше последнего корректного показания.',

      addNewPhotoForRegister:
        'Добавьте новое фото для {{register}}.',

      readingSavedTitle:
        'Показание сохранено',

      tenantReadingSavedMessage:
        'Ваши показания успешно переданы.',

      landlordReadingSavedMessage:
        'Новые показания сохранены.',

      unableToSaveReading:
        'Не удалось сохранить показание',

      cameraAccessDescription:
        'Dometra нужен доступ к камере, чтобы сфотографировать счётчик.',

      gallery:
        'Галерея',

      addNewMeterPhoto:
        'Добавьте новое фото счётчика',

      currentReadingPlaceholder:
        'Введите показание',

      sendMeterValuesBeforeFifth:
        'Передайте показания и свежие фото до 5-го числа месяца.',

      never:
        'Никогда',
    },
  },
} as const;