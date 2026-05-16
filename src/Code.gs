const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

function getServiceIcon(serviceName) {
  let icon;
  const name = serviceName.toLowerCase();
  if (name.includes('food')) {
    icon = '🍌';
  } else if (name.includes('rubbish') || name.includes('refuse')) {
    icon = '🗑️';
  } else if (name.includes('recycling') || name.includes('dmr')) {
    icon = '♻️';
  } else if (name.includes('garden')) {
    icon = '🍂';
  } else {
    icon = '❓';
  }

  return icon;
}

function checkCollectionDays(propertyId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const url = 'https://recyclingandrubbishcollections.camden.gov.uk/api/getCollectionDays';

  const payload = {
    "pointId": propertyId.toString(),
    "pointType": "PointAddress",
    "councilId": "27"
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  const services = data.activeServices || data.collectionServices;
  const address = (data.propertyInfo && data.propertyInfo.name) || data.address || "Address not provided";

  if (!services) {
    throw new Error(`API error for property ${propertyId}: ${response.getContentText()}`);
  }

  const result = {
    address: address,
    minDelay: 99,
    services: []
  };

  services.forEach(service => {
    if (!service.serviceSchedules) return;

    // Find next collection (Outstanding, Scheduled, Pending, or In Progress)
    const nextSchedule = service.serviceSchedules.find(s =>
      ['Outstanding', 'Scheduled', 'Pending'].includes(s.coreStateName) ||
      (s.state && s.state.toLowerCase().includes('in progress')) ||
      (!s.coreStateName && s.originalScheduledDate && new Date(s.originalScheduledDate) >= today)
    );

    // Find last collection
    const lastSchedule = service.serviceSchedules.find(s =>
      ['Complete', 'Not Done', 'Failed'].includes(s.coreStateName) ||
      (s.state && s.state.toLowerCase().includes('last collection'))
    );

    if (nextSchedule) {
      const nextDateStr = nextSchedule.currentScheduledDate || nextSchedule.originalScheduledDate;
      const nextCollectionDate = new Date(nextDateStr);
      nextCollectionDate.setHours(0, 0, 0, 0);

      const delay = Math.round((nextCollectionDate - today) / MILLISECONDS_IN_DAY);
      result.minDelay = Math.min(delay, result.minDelay);

      const formattedDate = Utilities.formatDate(nextCollectionDate, 'GMT', 'dd/MM/yyyy');

      let lastFormatted = 'N/A';
      if (lastSchedule) {
        const lastDateStr = lastSchedule.currentScheduledDate || lastSchedule.originalScheduledDate;
        let lastStatus = lastSchedule.coreStateName || lastSchedule.state;

        if (lastStatus && lastStatus.includes(': ')) {
          lastStatus = lastStatus.split(': ').pop();
        }

        if (lastDateStr) {
          const lastDate = new Date(lastDateStr);
          const formattedLastDate = Utilities.formatDate(lastDate, 'GMT', 'dd/MM/yyyy');
          lastFormatted = `${formattedLastDate} (${lastStatus})`;
        } else {
          lastFormatted = lastStatus;
        }
      }

      result.services.push({
        serviceName: service.serviceName,
        serviceIcon: getServiceIcon(service.serviceName),
        last: lastFormatted,
        next: formattedDate,
        nextReadable: delay === 1 ? 'tomorrow' : `in ${delay} days`,
        sign: delay === 1 ? '✅' : '❌'
      });
    }
  });

  return result;
}

function sendEmailReminders() {
  for (const el of PROPERTIES_LIST) {
    sendEmailReminder(el.recipients, el.propertyId);
  }
}

function sendEmailReminder(recipients, propertyId) {
  const collectionDays = checkCollectionDays(propertyId);

  if (collectionDays.minDelay !== 1) {
    console.log(`Next collection in ${collectionDays.minDelay} days - skip email.`);
    return;
  }

  const sortedServices = collectionDays.services.sort((a, b) => a.next > b.next ? 1 : -1);

  const serviceCards = sortedServices.map(service => `
    <div style="background-color: #ffffff; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #eef2f6; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 24px; margin-right: 12px;">${service.serviceIcon}</span>
        <div style="flex-grow: 1;">
          <h3 style="margin: 0; font-size: 18px; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${service.serviceName}</h3>
          <p style="margin: 4px 0 0; font-size: 14px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Last: ${service.last}</p>
        </div>
        <div style="font-size: 20px;">${service.sign}</div>
      </div>
      <div style="background-color: ${service.nextReadable === 'tomorrow' ? '#f0fdf4' : '#f8fafc'}; border-radius: 8px; padding: 12px; border: 1px solid ${service.nextReadable === 'tomorrow' ? '#dcfce7' : '#f1f5f9'};">
        <span style="font-size: 14px; font-weight: 600; color: ${service.nextReadable === 'tomorrow' ? '#166534' : '#475569'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          Next: ${service.next} (${service.nextReadable})
        </span>
      </div>
    </div>
  `).join('');

  const htmlBody = `
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="margin-bottom: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #0f172a; font-weight: 800;">🗑️ Collection Reminder</h1>
          <p style="margin: 8px 0 0; color: #64748b; font-size: 16px;">Don't forget to put your bins out!</p>
        </div>
        
        ${serviceCards}
        
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Property Address</p>
          <p style="margin: 4px 0 0; font-size: 15px; color: #475569; font-style: normal;">${collectionDays.address}</p>
        </div>
        
        <div style="margin-top: 40px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">&copy; ${new Date().getFullYear()} Camden Rubbish Scraper</p>
        </div>
      </div>
    </div>
  `;

  const servicesTomorrow = collectionDays.services
    .filter(service => service.nextReadable == 'tomorrow')
    .map(service => service.serviceIcon);

  const servicesLater = collectionDays.services
    .filter(service => service.nextReadable != 'tomorrow')
    .map(service => service.serviceIcon);

  const hasServicesLater = servicesLater.length > 0;
  const subject = `Bin Day: ${servicesTomorrow.join('')}${hasServicesLater ? ' (Next: ' + servicesLater.join('') + ')' : ''}`;

  MailApp.sendEmail({
    to: recipients,
    subject,
    htmlBody
  });
}